import { prisma } from "~/lib/db.server";

/**
 * Check if an ID number is already used by any tenant or occupant.
 * Returns the name of the person who already has the ID, or null if available.
 */
export async function findDuplicateId(
  idNumber: string,
  options?: { excludeTenantId?: number; excludeOccupantIds?: number[] }
): Promise<string | null> {
  if (!idNumber) return null;

  const tenant = await prisma.tenant.findFirst({
    where: {
      idNumber,
      ...(options?.excludeTenantId ? { id: { not: options.excludeTenantId } } : {}),
    },
  });

  if (tenant) {
    return `${tenant.firstName} ${tenant.lastName} (tenant)`;
  }

  const occupant = await prisma.occupant.findFirst({
    where: {
      idNumber,
      ...(options?.excludeOccupantIds?.length
        ? { id: { notIn: options.excludeOccupantIds } }
        : {}),
    },
  });

  if (occupant) {
    return `${occupant.firstName} ${occupant.lastName} (occupant)`;
  }

  return null;
}
