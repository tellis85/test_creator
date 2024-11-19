'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  finish: string;
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

  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [selectedColorCode, setSelectedColorCode] = useState('');
  const [selectedFinish, setSelectedFinish] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<SizeSelection>({});
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [labelQuantity, setLabelQuantity] = useState(1);
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

  // Reset sizes when series changes
  useEffect(() => {
    setSelectedSizes({});
  }, [selectedSeries]);

  // Template path helper function
  const getTemplatePath = (templateName: string) => {
    if (!templateName) return null;
    const cleanName = templateName.trim();
    return `/templates/daltile/${cleanName.replace(/\.png$/, '.jpg')}`;
  };

  // Updated memoized selectors for dropdowns
  const brands = useMemo(() => [...new Set(labelData.map(item => item.Brand))], [labelData]);
  
  const series = useMemo(() => {
    if (!selectedBrand) return [];
    return [...new Set(labelData
      .filter(item => item.Brand === selectedBrand)
      .map(item => item.seriesname))];
  }, [selectedBrand, labelData]);

  // Updated color codes logic to use Color Code + Color Name
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
    
    return Array.from(colorMap.values());
  }, [selectedBrand, selectedSeries, labelData]);

  // Updated finishes selector
  const finishesForColor = useMemo(() => {
    if (!selectedColorCode) return [];
    const colorData = colorCodes.find(c => c.displayName === selectedColorCode);
    return colorData?.finishes || [];
  }, [selectedColorCode, colorCodes]);

  // New available sizes selector
  const availableSizes = useMemo(() => {
    if (!selectedFinish || !selectedColorCode) return [];
    const colorData = colorCodes.find(c => c.displayName === selectedColorCode);
    const finishData = colorData?.finishes.find(f => f.finish === selectedFinish);
    return finishData?.sizes || [];
  }, [selectedColorCode, selectedFinish, colorCodes]);

  // Updated Label component with new color matching
  const Label = ({ labelConfig = null, scale = 1 }: LabelProps) => {
    const selectedData = labelConfig ? 
      labelData.find(item => 
        item.Brand === labelConfig.brand &&
        item.seriesname === labelConfig.series &&
        item['Color Code + Color Name'] === labelConfig.colorCode
      ) :
      labelData.find(item => 
        item.Brand === selectedBrand &&
        item.seriesname === selectedSeries &&
        item['Color Code + Color Name'] === selectedColorCode
      );

    const templatePath = selectedData ? getTemplatePath(selectedData['Background Template']) : null;
    const sizes = labelConfig ? labelConfig.sizes : selectedSizes;

    const baseWidth = 2 * 96;
    const baseHeight = 3 * 96;

    const selectedSizesText = Object.entries(sizes)
      .filter(([_, isSelected]) => isSelected)
      .map(([size]) => size)
      .join(', ');

    return (
      <div 
        className="relative bg-white"
        style={{
          width: `${baseWidth * scale}px`,
          height: `${baseHeight * scale}px`,
        }}
      >
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
            style={{
              position: 'absolute',
              top: 'calc(2in + 0.25in)',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontFamily: 'Geometria, Arial, sans-serif',
              fontSize: `${8 * scale}px`,
              lineHeight: '1.2',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '500',
              color: '#000000',
              margin: '1px 0',
            }}>
              {selectedData['Color Code + Color Name']}
            </div>
            {(labelConfig ? labelConfig.finish : selectedFinish) && (
              <div style={{
                fontFamily: 'Geometria, Arial, sans-serif',
                fontSize: `${8 * scale}px`,
                lineHeight: '1.2',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '500',
                color: '#000000',
                margin: '1px 0',
              }}>
                {labelConfig ? labelConfig.finish : selectedFinish}
              </div>
            )}
            {selectedSizesText && (
              <div style={{
                fontFamily: 'Geometria, Arial, sans-serif',
                fontSize: `${8 * scale}px`,
                lineHeight: '1.2',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '500',
                color: '#000000',
                margin: '1px 0',
              }}>
                {selectedSizesText}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Print Layout component remains the same
  const PrintLayout = () => {
    const expandedLabels = labelQueue.flatMap(label => 
      Array(label.quantity).fill(label)
    );
    const emptySlots = 8 - expandedLabels.length;
    
    return (
      <div 
        className="bg-white"
        style={{
          width: '11in',
          height: '8.5in',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 2in)',
            gridTemplateRows: 'repeat(2, 3in)',
            gap: '0.3in',
            pageBreakAfter: 'always',
            pageBreakInside: 'avoid',
            margin: 0,
            padding: 0
          }}
        >
          {expandedLabels.map((label, index) => (
            <div 
              key={index}
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
              key={`empty-${index}`}
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
  };

  // Updated handleAddToQueue with new color matching
  const handleAddToQueue = () => {
    if (!selectedColorCode) return;
    
    const totalCurrentLabels = labelQueue.reduce((sum, label) => sum + label.quantity, 0);
    if (totalCurrentLabels + labelQuantity > 8) {
      alert('Maximum of 8 labels can be added to the layout');
      return;
    }

    const newLabel: QueuedLabel = {
      brand: selectedBrand,
      series: selectedSeries,
      colorCode: selectedColorCode,
      finish: selectedFinish || 'N/A', // Ensure finish is included even if optional
      sizes: { ...selectedSizes }, // Ensure sizes are included
      displayName: selectedColorCode,
      quantity: labelQuantity,
    };

    setLabelQueue(prev => [...prev, newLabel]);

    // Reset form state
    setSelectedBrand('');
    setSelectedSeries('');
    setSelectedColorCode('');
    setSelectedFinish('');
    setSelectedSizes({});
    setLabelQuantity(1);
  };

  const removeFromQueue = (index: number) => {
    setLabelQueue(prev => prev.filter((_, i) => i !== index));
  };

  const handleGeneratePDF = async () => {
    const printLayout = document.getElementById('print-layout');
    if (!printLayout) return;

    try {
      const width = 11 * 96;
      const height = 8.5 * 96;

      const canvas = await html2canvas(printLayout, {
        scale: 4,
        useCORS: true,
        logging: false,
        width: width,
        height: height,
        backgroundColor: '#ffffff',
        windowWidth: width,
        windowHeight: height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'in',
        format: [11, 8.5]
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, 11, 8.5, undefined, 'FAST');
      pdf.save('labels.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading label data...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                setSelectedFinish('');
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
                setSelectedFinish('');
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

          {/* Updated Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <select 
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              value={selectedColorCode}
              onChange={(e) => {
                setSelectedColorCode(e.target.value);
                setSelectedFinish('');
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

          {/* Finish Selection */}
          {finishesForColor.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
              <select 
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                value={selectedFinish}
                onChange={(e) => {
                  setSelectedFinish(e.target.value);
                  setSelectedSizes({});
                }}
                disabled={!selectedColorCode}
              >
                <option value="">Select Finish</option>
                {finishesForColor.map(({ finish }) => (
                  <option key={finish} value={finish}>{finish}</option>
                ))}
              </select>
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
              Quantity (Total {labelQueue.reduce((sum, label) => sum + label.quantity, 0)}/8)
            </label>
            <input
              type="number"
              min="1"
              max="8"
              value={labelQuantity}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value > 0 && value <= 8) {
                  setLabelQuantity(value);
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
              disabled={!selectedColorCode}
            >
              Add Label to Queue
            </button>
          </div>

          {/* Queue Display */}
          {labelQueue.length > 0 && (
            <div className="mt-4 border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-medium mb-2">
                Queued Labels ({labelQueue.reduce((sum, label) => sum + label.quantity, 0)}/8)
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

        {/* Preview Panel */}
        <div className="border rounded-lg p-4 bg-white min-h-[384px] flex items-center justify-center">
          <Label scale={1} />
        </div>
      </div>

      {/* Print Layout Dialog */}
      <Dialog open={showPrintLayout} onOpenChange={setShowPrintLayout}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-y-auto">
          <div id="print-layout" className="bg-white flex items-center justify-center">
            <PrintLayout />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => setShowPrintLayout(false)}
            >
              Close
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              onClick={handleGeneratePDF}
            >
              Download PDF
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Layout Button */}
      <div className="mt-8">
        <button
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={() => setShowPrintLayout(true)}
          disabled={labelQueue.length === 0}
        >
          Preview Print Layout ({labelQueue.reduce((sum, label) => sum + label.quantity, 0)} labels)
        </button>
      </div>
    </div>
  );
};
