import type {SpendAllocation} from 'getsentry/views/spendAllocations/components/types';

const now = new Date('2018-09-25'); // pin to subscription fixture start
const future = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

const nowStr = now.toISOString();
const futureStr = future.toISOString();

const mockRootAllocations: SpendAllocation[] = [
  {
    id: 1,
    billingMetric: 'error', // NOTE: db billingMetrics are singular and lowercase
    consumedQuantity: 0,
    costPerItem: 1,
    period: [nowStr, futureStr],
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
    period: [nowStr, futureStr],
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
    period: [nowStr, futureStr],
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
    period: [nowStr, futureStr],
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
    period: [nowStr, futureStr],
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
    period: [nowStr, futureStr],
    reservedQuantity: 10,
    targetId: 3,
    targetSlug: 'Projfoo-transaction',
    targetType: 'Project',
    shouldRecreate: true,
  },
];

const mockSpendAllocations = [...mockRootAllocations, ...mockProjectAllocations];

export {mockSpendAllocations, mockRootAllocations};
