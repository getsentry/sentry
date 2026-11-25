import type {SpendAllocation} from 'getsentry/views/spendAllocations/components/types';

const mockRootAllocations: SpendAllocation[] = [
  {
    id: 1,
    billingMetric: 'error', // NOTE: db billingMetrics are singular and lowercase
    consumedQuantity: 0,
    costPerItem: 1,
    reservedQuantity: 100,
    targetId: 1,
    targetSlug: 'Orgfoo-errrs',
    targetType: 'Organization',
    shouldRecreate: true,
  },
  {
    id: 2,
    billingMetric: 'transaction',
    consumedQuantity: 0,
    costPerItem: 1,
    reservedQuantity: 100,
    targetId: 2,
    targetSlug: 'Orgfoo-transactions',
    targetType: 'Organization',
    shouldRecreate: true,
  },
  {
    id: 3,
    billingMetric: 'attachment',
    consumedQuantity: 0,
    costPerItem: 1,
    reservedQuantity: 100,
    targetId: 2,
    targetSlug: 'Orgfoo-attachments',
    targetType: 'Organization',
    shouldRecreate: true,
  },
];
const mockProjectAllocations: SpendAllocation[] = [
  {
    id: 4,
    billingMetric: 'error',
    consumedQuantity: 0,
    costPerItem: 1,
    reservedQuantity: 100,
    targetId: 1,
    targetSlug: 'Projfoo-E1',
    targetType: 'Project',
    shouldRecreate: true,
  },
  {
    id: 5,
    billingMetric: 'error',
    consumedQuantity: 0,
    costPerItem: 1,
    reservedQuantity: 50,
    targetId: 2,
    targetSlug: 'Projfoo-E2',
    targetType: 'Project',
    shouldRecreate: true,
  },
  {
    id: 6,
    billingMetric: 'transaction',
    consumedQuantity: 0,
    costPerItem: 1,
    reservedQuantity: 10,
    targetId: 3,
    targetSlug: 'Projfoo-transaction',
    targetType: 'Project',
    shouldRecreate: true,
  },
];

const mockSpendAllocations = [...mockRootAllocations, ...mockProjectAllocations];

export {mockSpendAllocations, mockRootAllocations};
