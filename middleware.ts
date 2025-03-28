import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Get all cookies and find the WordPress login cookie
  const allCookies = request.cookies.getAll();
  const wpLoggedInCookie = allCookies.find(cookie => 
    cookie.name.startsWith('wordpress_logged_in_')
  );
  
  // If no WordPress cookie exists, redirect to login
  if (!wpLoggedInCookie) {
    const returnUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(`https://daltileprintpro.com/wp-login.php?redirect_to=${returnUrl}`);
  }
  
  // Validate the session with WordPress
  try {
    const response = await fetch('https://daltileprintpro.com/wp-json/wp/v2/users/me', {
      headers: {
        Cookie: `${wpLoggedInCookie.name}=${wpLoggedInCookie.value}`
      }
    });
    
    // If response is not OK, redirect to login
    if (!response.ok) {
      const returnUrl = encodeURIComponent(request.url);
      return NextResponse.redirect(`https://daltileprintpro.com/wp-login.php?redirect_to=${returnUrl}`);
    }
  } catch (error) {
    // Handle network errors
    const returnUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(`https://daltileprintpro.com/wp-login.php?redirect_to=${returnUrl}`);
  }
  
  return NextResponse.next();
}

// Configure which paths require authentication
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};