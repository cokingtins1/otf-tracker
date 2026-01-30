import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/auth/google';
import { saveOAuthTokens } from '@/lib/db/oauth-tokens';
// import { prisma } from '@/lib/db/prisma';
import  prisma  from "@/prisma/__base"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens from OAuth response');
    }

    // Get or create user
    const userEmail = process.env.ADMIN_EMAIL!;
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: 'Admin User',
        },
      });
    }

    // Save tokens
    const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600 * 1000));
    await saveOAuthTokens(
      user.id,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt
    );

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
