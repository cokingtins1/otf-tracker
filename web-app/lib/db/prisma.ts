// Re-export from new location for backwards compatibility
// All new code should import from '@/prisma/__base' directly
import prisma from '@/prisma/__base';

export { prisma };
export default prisma;
