export type SpendAllocation = {
  billingMetric: string;
  consumedQuantity: number;
  costPerItem: number;
  id: number;
  reservedQuantity: number;
  shouldRecreate: boolean;
  targetId: number;
  targetSlug: string;
  targetType: string;
};
