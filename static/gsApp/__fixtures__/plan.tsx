import type {Plan} from 'getsentry/types';

export function PlanFixture(fields: Partial<Plan>): Plan {
  return {
    allowAdditionalReservedEvents: false,
    allowOnDemand: false,
    availableCategories: [],
    basePrice: 0,
    billingInterval: 'monthly',
    categories: [],
    checkoutCategories: [],
    contractInterval: 'monthly',
    description: '',
    features: [],
    hasOnDemandModes: false,
    id: 'am2_f',
    maxMembers: 1,
    name: 'Developer',
    onDemandCategories: [],
    onDemandEventPrice: 0,
    planCategories: {
      errors: [
        {events: 50000, unitPrice: 0.089, price: 0},
        {events: 100000, unitPrice: 0.05, price: 4500},
      ],
      transactions: [
        {events: 100000, unitPrice: 0.0445, price: 0},
        {events: 250000, unitPrice: 0.0358, price: 4500},
      ],
      replays: [
        {events: 500, unitPrice: 0.2925, price: 0},
        {events: 10000, unitPrice: 0.288, price: 2900},
      ],
      attachments: [
        {events: 1, unitPrice: 25, price: 0},
        {events: 25, unitPrice: 25, price: 600},
      ],
      monitorSeats: [{events: 1, unitPrice: 60, price: 0, onDemandPrice: 78}],
    },
    price: 0,
    reservedMinimum: 0,
    retentionDays: 0,
    totalPrice: 0,
    trialPlan: null,
    userSelectable: true,
    categoryDisplayNames: {},
    ...fields,
  };
}
