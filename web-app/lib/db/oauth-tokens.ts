import prisma from '@/prisma/__base';
import { encryptToken, decryptToken } from '../auth/token-encryption';
import { getOAuth2Client } from '../auth/google';

export async function saveOAuthTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
) {
  return prisma.oAuthToken.upsert({
    where: { userId },
    update: {
      accessToken: encryptToken(accessToken),
      refreshToken: encryptToken(refreshToken),
      expiresAt,
      updatedAt: new Date(),
    },
    create: {
      userId,
      accessToken: encryptToken(accessToken),
      refreshToken: encryptToken(refreshToken),
      expiresAt,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
    },
  });
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) return null;

  // If token expired, refresh it
  if (new Date() >= tokenRecord.expiresAt) {
    try {
      const newTokens = await refreshAccessToken(decryptToken(tokenRecord.refreshToken));

      if (!newTokens.access_token || !newTokens.expiry_date) {
        throw new Error('Invalid token response from refresh');
      }

      const newExpiresAt = new Date(newTokens.expiry_date);

      await saveOAuthTokens(
        userId,
        newTokens.access_token,
        newTokens.refresh_token || decryptToken(tokenRecord.refreshToken),
        newExpiresAt
      );

      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  return decryptToken(tokenRecord.accessToken);
}

async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}
