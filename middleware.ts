import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 3;

  // Get current count for this IP
  const current = requestCounts.get(ip);

  if (!current || now > current.resetTime) {
    // First request or window has reset
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return NextResponse.next();
  }

  if (current.count >= maxRequests) {
    // Rate limit exceeded
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded. Please try again in 10 minutes.',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString(),
        }
      }
    );
  }

  // Increment count
  current.count++;
  requestCounts.set(ip, current);

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};