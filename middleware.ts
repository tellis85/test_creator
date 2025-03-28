import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Check for WordPress authentication cookie
  const wpLoggedInCookie = request.cookies.get('wordpress_logged_in_');
  
  // If no WordPress cookie exists, redirect to login
  if (!wpLoggedInCookie) {
    const returnUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(`https://daltileprintpro.com/`);
  }
  
  // Validate the session with WordPress
  try {
    const response = await fetch('https://daltileprintpro.com/wp-json/wp/v2/users/me', {
      headers: {
        Cookie: `wordpress_logged_in_=${wpLoggedInCookie.value}`
      }
    });
    
    // If response is not OK, redirect to login
    if (!response.ok) {
      const returnUrl = encodeURIComponent(request.url);
      return NextResponse.redirect(`https://daltileprintpro.com/`);
    }
  } catch (error) {
    // Handle network errors - optional: log the error
    const returnUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(`https://daltileprintpro.com/`);
  }
  
  return NextResponse.next();
}

// Configure which paths require authentication
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};