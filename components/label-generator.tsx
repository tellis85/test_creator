'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface LabelItem {
  Brand: string;
  seriesname: string;
  colorcode: string;
  "Background Template": string;
  finish: string;
  colorname: string;
  "Color Code + Color Name": string;
  nominalsize_1: string;
  nominalsize_2: string;
  nominalsize_3: string;
  nominalsize_4: string;
  nominalsize_5: string;
  nominalsize_6: string;
  nominalsize_7: string;
  nominalsize_8: string;
  nominalsize_9: string;
  nominalsize_10: string;
}

interface ColorData {
  code: string;
  displayName: string;
  finishes: {
    finish: string;
    sizes: string[];
  }[];
}

interface QueuedLabel {
  brand: string;
  series: string;
  colorCode: string;
  finishes: string[];
  sizes: { [key: string]: boolean };
  displayName: string;
  quantity: number;
}

interface LabelProps {
  labelConfig?: QueuedLabel | null;
  scale?: number;
}

interface SizeSelection {
  [key: string]: boolean;
}

export const LabelGenerator = () => {
  const [labelData, setLabelData] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(1.75);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrintLayoutVisible, setIsPrintLayoutVisible] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [selectedColorCode, setSelectedColorCode] = useState('');
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<SizeSelection>({});
  const [labelQuantity, setLabelQuantity] = useState('');
  const [labelQueue, setLabelQueue] = useState<QueuedLabel[]>([]);

  // Load CSV data
  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/data/Reformatted_Data.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n');
        const parsedData = lines
          .slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(value => value.trim());
            return {
              Brand: values[0] || '',
              seriesname: values[1] || '',
              colorcode: values[2] || '',
              "Background Template": values[3] || '',
              finish: values[4] || '',
              colorname: values[5] || '',
              "Color Code + Color Name": values[6] || '',
              nominalsize_1: values[7] || '',
              nominalsize_2: values[8] || '',
              nominalsize_3: values[9] || '',
              nominalsize_4: values[10] || '',
              nominalsize_5: values[11] || '',
              nominalsize_6: values[12] || '',
              nominalsize_7: values[13] || '',
              nominalsize_8: values[14] || '',
              nominalsize_9: values[15] || '',
              nominalsize_10: values[16] || ''
            } as LabelItem;
          });

        setLabelData(parsedData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading CSV:', err);
        setError('Failed to load label data');
        setLoading(false);
      }
    };

    loadCSV();
  }, []);

  useEffect(() => {
    setSelectedSizes({});
  }, [selectedSeries]);

  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  };

  const getTemplatePath = (templateName: string) => {
    if (!templateName) return null;
    const cleanName = templateName.trim();
    return `/templates/daltile/${cleanName.replace(/\.png$/, '.jpg')}`;
  };

  const brands = useMemo(() => [...new Set(labelData.map(item => item.Brand))], [labelData]);
  
  const series = useMemo(() => {
    if (!selectedBrand) return [];
    return [...new Set(labelData
      .filter(item => item.Brand === selectedBrand)
      .map(item => item.seriesname))];
  }, [selectedBrand, labelData]);

  const colorCodes = useMemo(() => {
    if (!selectedSeries) return [];
    
    const colorMap = new Map<string, ColorData>();
    
    labelData
      .filter(item => 
        item.Brand === selectedBrand && 
        item.seriesname === selectedSeries
      )
      .forEach(item => {
        const colorKey = item['Color Code + Color Name'];
        
        if (!colorMap.has(colorKey) && colorKey) {
          colorMap.set(colorKey, {
            code: colorKey,
            displayName: colorKey,
            finishes: []
          });
        }
        
        const colorData = colorMap.get(colorKey);
        if (colorData && item.finish && item.finish !== "NULL") {
          const existingFinish = colorData.finishes.find(f => f.finish === item.finish);
          
          if (!existingFinish) {
            const sizes = Array.from({ length: 10 }, (_, i) => item[`nominalsize_${i + 1}` as keyof LabelItem])
              .filter(size => size && size !== '');
            
            colorData.finishes.push({
              finish: item.finish,
              sizes
            });
          }
        }
      });
    
    return Array.from(colorMap.values()).sort((a, b) => 
      a.displayName.localeCompare(b.displayName, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      })
    );
  }, [selectedBrand, selectedSeries, labelData]);

  const finishesForColor = useMemo(() => {
    if (!selectedColorCode) return [];
    const colorData = colorCodes.find(c => c.displayName === selectedColorCode);
    return colorData?.finishes || [];
  }, [selectedColorCode, colorCodes]);

  const availableSizes = useMemo(() => {
    if (selectedFinishes.length === 0 || !selectedColorCode) return [];
    const colorData = colorCodes.find(c => c.displayName === selectedColorCode);
    const allSizes = new Set<string>();
    
    selectedFinishes.forEach(finish => {
      const finishData = colorData?.finishes.find(f => f.finish === finish);
      finishData?.sizes.forEach(size => allSizes.add(size));
    });

    return Array.from(allSizes).sort((a, b) => {
      const numA = parseFloat(a.replace(/[^\d.]/g, ''));
      const numB = parseFloat(b.replace(/[^\d.]/g, ''));
      return numA - numB;
    });
  }, [selectedColorCode, selectedFinishes, colorCodes]);

  const Label = ({ labelConfig = null, scale = 1 }: LabelProps) => {
    const selectedData = labelConfig ? 
  labelData.find(item => 
    item.Brand === labelConfig.brand &&
    item.seriesname === labelConfig.series &&
    item['Color Code + Color Name'] === labelConfig.colorCode
  ) :
  labelData.find(item => 
    item.Brand === selectedBrand &&
    item.seriesname === selectedSeries
  );
  
    const templatePath = selectedData ? getTemplatePath(selectedData['Background Template']) : null;
    const sizes = labelConfig ? labelConfig.sizes : selectedSizes;
  
    const selectedSizesText = Object.entries(sizes)
      .filter(([_, isSelected]) => isSelected)
      .map(([size]) => size)
      .map(size => `<span style="white-space: nowrap">${size}</span>`)
      .join(', ');
  
    const displayColorCode = labelConfig ? labelConfig.colorCode : selectedColorCode;
    const displayFinishes = labelConfig ? labelConfig.finishes : selectedFinishes;
  
    const baseWidth = 2 * 96;
    const baseHeight = 3 * 96;
  
    return (
      <div 
        className="relative bg-white"
        style={{
          width: `${baseWidth * scale}px`,
          height: `${baseHeight * scale}px`,
        }}
      >
        <style>
          {`
            @media print {
              .label-text-container {
                top: 50px !important;
              }
            }
          `}
        </style>
        {templatePath && (
          <img 
            src={templatePath}
            alt="Label Template"
            className="w-full h-full object-contain"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.error('Template load error:', templatePath);
              e.currentTarget.src = "/api/placeholder/192/288";
            }}
          />
        )}
        {selectedData && (
          <div 
            className="label-text-container"
            style={{
              position: 'absolute',
              top: '213px',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'center',
              gap: '.5px',
            }}
          >
            {displayColorCode && (
              <div style={{
                fontFamily: 'Geometria, Arial, sans-serif',
                fontSize: `${8 * scale}px`,
                lineHeight: '1.2',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '500',
                color: '#000000',
                margin: '0',
                padding: '0'
              }}>
                {displayColorCode}
              </div>
            )}
            {displayFinishes.length > 0 && (
              <div style={{
                fontFamily: 'Geometria, Arial, sans-serif',
                fontSize: `${8 * scale}px`,
                lineHeight: '1.2',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '500',
                color: '#000000',
                margin: '0',
                padding: '0'
              }}>
                {displayFinishes.join(', ')}
              </div>
            )}
            {selectedSizesText && (
              <div 
                style={{
                  fontFamily: 'Geometria, Arial, sans-serif',
                  fontSize: `${8 * scale}px`,
                  lineHeight: '1.1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: '500',
                  color: '#000000',
                  margin: '0',
                  padding: '0',
                  width: '1.7in',
                  wordBreak: 'break-word',
                }}
                dangerouslySetInnerHTML={{ __html: selectedSizesText }}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const PrintLayout = () => {
    const expandedLabels = labelQueue.flatMap(label => 
      Array(label.quantity).fill(label)
    );
    
    const labelsPerSheet = 8;
    const totalSheets = Math.ceil(expandedLabels.length / labelsPerSheet);
    const sheets = Array.from({ length: totalSheets }, (_, sheetIndex) => {
      const startIdx = sheetIndex * labelsPerSheet;
      const sheetLabels = expandedLabels.slice(startIdx, startIdx + labelsPerSheet);
      const emptySlots = labelsPerSheet - sheetLabels.length;
      
      return (
        <div 
          key={`sheet-${sheetIndex}`}
          id={`sheet-${sheetIndex}`}
          className="bg-white page-break-after"
          style={{
            width: '11in',
            height: '8.5in',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pageBreakAfter: sheetIndex < totalSheets - 1 ? 'always' : 'auto',
            margin: '20px 0'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 2in)',
              gridTemplateRows: 'repeat(2, 3in)',
              columnGap: '0.35in',
              rowGap: '0.8in',
              pageBreakInside: 'avoid',
              margin: 0,
              padding: 0
            }}
          >
            {sheetLabels.map((label, index) => (
              <div 
                key={`${sheetIndex}-${index}`}
                style={{ 
                  width: '2in', 
                  height: '3in',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid'
                }}
              >
                <Label labelConfig={label} scale={1} />
              </div>
            ))}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <div 
                key={`empty-${sheetIndex}-${index}`}
                style={{ 
                  width: '2in', 
                  height: '3in',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid'
                }}
              />
            ))}
          </div>
        </div>
      );
    });

    return <div>{sheets}</div>;
  };

  const handleGeneratePDF = async (preview = false) => {
    try {
      setIsGenerating(true);
      setIsPrintLayoutVisible(true);
      
      // Wait for the print layout to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));
  
      const printLayout = document.getElementById('print-layout');
      if (!printLayout) {
        throw new Error('Print layout not found');
      }
  
      const expandedLabels = labelQueue.flatMap(label =>
        Array(label.quantity).fill(label)
      );
      const totalSheets = Math.ceil(expandedLabels.length / 8);
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'in',
        format: [11, 8.5]
      });
  
      for (let i = 0; i < totalSheets; i++) {
        const sheet = document.getElementById(`sheet-${i}`);
        if (!sheet) continue;
  
        if (i > 0) {
          pdf.addPage([11, 8.5], 'landscape');
        }
  
        try {
          // Get all images in the sheet
          const images = sheet.getElementsByTagName('img');
          for (let img of Array.from(images)) {
            if (img.src.startsWith('data:')) continue;
            const base64Image = await loadImage(img.src);
            img.src = base64Image;
          }
  
          // Wait for images to be loaded
          await new Promise(resolve => setTimeout(resolve, 50));
  
          // Capture the sheet with adjusted settings
          const canvas = await html2canvas(sheet, {
            scale: 4,
            useCORS: true,
            logging: false,
            width: 11 * 96,
            height: 8.5 * 96,
            backgroundColor: '#ffffff',
            // Add these new options
            windowWidth: 11 * 96,
            windowHeight: 8.5 * 96,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            // Force a specific DPI
            foreignObjectRendering: false,
            imageTimeout: 0,
            // Add custom HTML2Canvas options
            onclone: (clonedDoc) => {
              // Find all text containers in cloned document
              const textContainers = clonedDoc.getElementsByClassName('label-text-container');
              for (let container of Array.from(textContainers)) {
                // Adjust the position for PDF output
                const element = container as HTMLElement;
                element.style.top = '206px'; // Adjust this value as needed
                element.style.transform = 'none';
                element.style.webkitTransform = 'none';
                element.style.position = 'absolute';
              }
            }
          });
  
          // Add the image to PDF with specific positioning
          const imgData = canvas.toDataURL('image/png', 1.0);
          pdf.addImage(imgData, 'PNG', 0, 0, 11, 8.5, undefined, 'FAST');
  
        } catch (err) {
          console.error('Error processing sheet:', err);
          continue;
        }
      }
  
      if (preview) {
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
      } else {
        pdf.save('labels.pdf');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
      setIsPrintLayoutVisible(false);
    }
  };

  const handleAddToQueue = () => {
    if (!selectedColorCode || selectedFinishes.length === 0) return;
    
    const newLabel: QueuedLabel = {
      brand: selectedBrand,
      series: selectedSeries,
      colorCode: selectedColorCode,
      finishes: [...selectedFinishes],
      sizes: { ...selectedSizes },
      displayName: selectedColorCode,
      quantity: Number(labelQuantity),
    };
  
    setLabelQueue(prev => [...prev, newLabel]);
    setLabelQuantity('');
  };

  const removeFromQueue = (index: number) => {
    setLabelQueue(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="p-8 text-center">Loading label data...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column - Selection controls */}
        <div className="space-y-6">
          {/* Brand Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <select 
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setSelectedSeries('');
                setSelectedColorCode('');
                setSelectedFinishes([]);
                setSelectedSizes({});
              }}
            >
              <option value="">Select Brand</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          {/* Series Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
            <select 
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              value={selectedSeries}
              onChange={(e) => {
                setSelectedSeries(e.target.value);
                setSelectedColorCode('');
                setSelectedFinishes([]);
                setSelectedSizes({});
              }}
              disabled={!selectedBrand}
            >
              <option value="">Select Series</option>
              {series.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <select 
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              value={selectedColorCode}
              onChange={(e) => {
                setSelectedColorCode(e.target.value);
                setSelectedFinishes([]);
                setSelectedSizes({});
              }}
              disabled={!selectedSeries}
            >
              <option value="">Select Color</option>
              {colorCodes.map(({ displayName }) => (
                <option key={displayName} value={displayName}>{displayName}</option>
              ))}
            </select>
          </div>

          {/* Finish Selection - Modified to checkboxes */}
          {finishesForColor.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Finishes</label>
              <div className="space-y-2">
                {finishesForColor.map(({ finish }) => (
                  <div key={finish} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`finish-${finish}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedFinishes.includes(finish)}
                      onChange={(e) => {
                        setSelectedFinishes(prev =>
                          e.target.checked
                            ? [...prev, finish]
                            : prev.filter(f => f !== finish)
                        );
                        setSelectedSizes({});
                      }}
                      disabled={!selectedColorCode}
                    />
                    <label
                      htmlFor={`finish-${finish}`}
                      className="ml-2 text-sm text-gray-700"
                    >
                      {finish}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Size Selection */}
          {availableSizes.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Available Sizes</label>
              <div className="space-y-2">
                {availableSizes.map((size) => (
                  <div key={size} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`size-${size}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedSizes[size] || false}
                      onChange={(e) => {
                        setSelectedSizes(prev => ({
                          ...prev,
                          [size]: e.target.checked
                        }));
                      }}
                    />
                    <label
                      htmlFor={`size-${size}`}
                      className="ml-2 text-sm text-gray-700"
                    >
                      {size}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity (Total labels: {labelQueue.reduce((sum, label) => sum + label.quantity, 0)})
            </label>
            <input
              type="number"
              min="1"
              value={labelQuantity}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value > 0) {
                  setLabelQuantity(value.toString());
                }
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Add to Queue Button */}
          <div>
            <button
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              onClick={handleAddToQueue}
              disabled={!selectedColorCode || selectedFinishes.length === 0}
            >
              Add Label to Queue
            </button>
          </div>

          {/* Queue Display */}
          {labelQueue.length > 0 && (
            <div className="mt-4 border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-medium mb-2">
                Queued Labels (Total: {labelQueue.reduce((sum, label) => sum + label.quantity, 0)})
              </h3>
              <div className="space-y-2">
                {labelQueue.map((label, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                    <span className="text-sm">
                      {label.series} - {label.displayName} (×{label.quantity})
                    </span>
                    <button
                      onClick={() => removeFromQueue(index)}
                      className="text-red-600 hover:text-red-700 text-sm px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - Preview */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Preview ({Math.round(previewScale * 100)}%)</span>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={() => setPreviewScale(prev => Math.max(0.5, prev - 0.25))}
              >
                −
              </button>
              <button
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={() => setPreviewScale(1.75)}
              >
                Reset
              </button>
              <button
                className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={() => setPreviewScale(prev => Math.min(3, prev + 0.25))}
              >
                +
              </button>
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-white min-h-[600px] flex items-center justify-center overflow-auto">
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'center center', transition: 'transform 0.2s' }}>
              <Label scale={1} />
            </div>
          </div>
        </div>
      </div>

      {/* Print Layout - Hidden but used for rendering */}
      <div 
  id="print-layout" 
  style={{ 
    display: isPrintLayoutVisible ? 'block' : 'none',
    position: 'fixed',
    left: '-9999px',
    top: '-9999px'
  }}
>
  <PrintLayout />
</div>

      {/* Preview/Print Button */}
      <div className="mt-8">
        <button
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={() => handleGeneratePDF(true)}
          disabled={labelQueue.length === 0 || isGenerating}
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Generating PDF...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Preview PDF ({labelQueue.reduce((sum, label) => sum + label.quantity, 0)} labels on {Math.ceil(labelQueue.reduce((sum, label) => sum + label.quantity, 0) / 8)} sheets)
            </>
          )}
        </button>
      </div>
      <div className="mt-4 text-center">
        <span style={{ fontSize: '30pt', fontWeight: 'bold', color: 'red' }}>
          ***Use Avery Label Presta 94237***
        </span>
      </div>
    </div>
  );
};
