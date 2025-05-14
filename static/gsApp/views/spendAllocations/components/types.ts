export type SpendAllocation = {
  billingMetric: string;
  consumedQuantity: number;
  costPerItem: number;
  id: number;
  period: [string, string]; // parseable ISO time strings
  reservedQuantity: number;
  shouldRecreate: boolean;
  targetId: number;
  targetSlug: string;
  targetType: string;
};
