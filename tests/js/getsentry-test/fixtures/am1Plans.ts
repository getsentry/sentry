import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {Plan} from 'getsentry/types';

const AM1_CATEGORIES = [
  'errors',
  'transactions',
  'replays',
  'attachments',
  'monitorSeats',
  'uptime',
];

const AM1_CATEGORY_DISPLAY_NAMES = {
  errors: {singular: 'error', plural: 'errors'},
  transactions: {singular: 'transaction', plural: 'transactions'},
  replays: {singular: 'replay', plural: 'replays'},
  attachments: {singular: 'attachment', plural: 'attachments'},
  monitorSeats: {singular: 'cron monitor', plural: 'cron monitors'},
  uptime: {singular: 'uptime monitor', plural: 'uptime monitors'},
};

const AM1_FREE_FEATURES = [
  'advanced-search',
  'event-attachments',
  'performance-view',
  'integrations-stacktrace-link',
  'session-replay',
  'monitor-seat-billing',
  'uptime',
];

const AM1_TEAM_FEATURES = [
  ...AM1_FREE_FEATURES,
  'codecov-integration',
  'crash-rate-alerts',
  'dashboards-basic',
  'discover-basic',
  'incidents',
  'integrations-issue-basic',
  'integrations-issue-sync',
  'integrations-alert-rule',
  'integrations-chat-unfurl',
  'integrations-incident-management',
  'sso-basic',
  'weekly-reports',
  'on-demand-metrics-prefill',
];

const AM1_BUSINESS_FEATURES = [
  ...AM1_TEAM_FEATURES,
  'anomaly-detection-alerts',
  'app-store-connect-multiple',
  'baa',
  'change-alerts',
  'custom-inbound-filters',
  'custom-symbol-sources',
  'dashboards-edit',
  'data-forwarding',
  'discard-groups',
  'discover-query',
  'global-views',
  'integrations-codeowners',
  'integrations-enterprise-alert-rule',
  'integrations-enterprise-incident-management',
  'integrations-event-hooks',
  'integrations-ticket-rules',
  'rate-limits',
  'relay',
  'sso-saml2',
  'team-insights',
  'team-roles',
];

const AM1_TRIAL_FEATURES = AM1_BUSINESS_FEATURES.filter(
  feature => feature !== 'sso-saml2' && feature !== 'baa'
);

const AM1_PLANS: Record<string, Plan> = {
  am1_f: {
    allowAdditionalReservedEvents: false,
    availableCategories: [],
    onDemandEventPrice: 0,
    reservedMinimum: 0,
    totalPrice: 0,
    id: 'am1_f',
    name: 'Developer',
    description: '',
    categoryDisplayNames: AM1_CATEGORY_DISPLAY_NAMES,
    categories: AM1_CATEGORIES,
    checkoutCategories: AM1_CATEGORIES,
    onDemandCategories: AM1_CATEGORIES,
    hasOnDemandModes: true,
    trialPlan: 'am1_t',
    basePrice: 0,
    price: 0,
    maxMembers: 1,
    allowOnDemand: false,
    userSelectable: true,
    retentionDays: 30,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    planCategories: {
      errors: [
        {
          price: 0,
          unitPrice: 0,
          events: 5000,
        },
      ],
      transactions: [
        {
          price: 0,
          unitPrice: 0,
          events: 10000,
        },
      ],
      replays: [
        {
          price: 0,
          unitPrice: 0,
          events: 50,
        },
      ],
      attachments: [
        {
          price: 0,
          unitPrice: 0,
          events: 1,
        },
      ],
      monitorSeats: [
        {
          price: 0,
          unitPrice: 0,
          events: 1,
        },
      ],
      uptime: [
        {
          price: 0,
          unitPrice: 0,
          events: 1,
        },
      ],
    },
    features: AM1_FREE_FEATURES,
  },
  am1_t: {
    allowAdditionalReservedEvents: false,
    availableCategories: [],
    onDemandEventPrice: 0,
    reservedMinimum: 0,
    totalPrice: 0,
    id: 'am1_t',
    name: 'Trial',
    description: '',
    categoryDisplayNames: AM1_CATEGORY_DISPLAY_NAMES,
    categories: AM1_CATEGORIES,
    checkoutCategories: AM1_CATEGORIES,
    onDemandCategories: AM1_CATEGORIES,
    hasOnDemandModes: true,
    trialPlan: null,
    basePrice: 0,
    price: 0,
    maxMembers: 20,
    allowOnDemand: false,
    userSelectable: false,
    retentionDays: 90,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    planCategories: {
      errors: [
        {
          price: 0,
          unitPrice: 0,
          events: 0,
        },
      ],
      transactions: [
        {
          price: 0,
          unitPrice: 0,
          events: 0,
        },
      ],
      replays: [
        {
          price: 0,
          unitPrice: 0,
          events: 0,
        },
      ],
      attachments: [
        {
          price: 0,
          unitPrice: 0,
          events: 0,
        },
      ],
      monitorSeats: [
        {
          price: 0,
          unitPrice: 0,
          events: 0,
        },
      ],
      uptime: [
        {
          price: 0,
          unitPrice: 0,
          events: 0,
        },
      ],
    },
    features: AM1_TRIAL_FEATURES,
  },
  am1_team: {
    allowAdditionalReservedEvents: false,
    availableCategories: [],
    onDemandEventPrice: 0,
    reservedMinimum: 0,
    totalPrice: 0,
    id: 'am1_team',
    name: 'Team',
    description: '',
    categoryDisplayNames: AM1_CATEGORY_DISPLAY_NAMES,
    categories: AM1_CATEGORIES,
    checkoutCategories: AM1_CATEGORIES,
    onDemandCategories: AM1_CATEGORIES,
    hasOnDemandModes: true,
    trialPlan: null,
    basePrice: 2900,
    price: 2900,
    maxMembers: null,
    allowOnDemand: true,
    userSelectable: true,
    retentionDays: 90,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    planCategories: {
      errors: [
        {
          events: 50000,
          unitPrice: 0.029,
          price: 0,
        },
        {
          events: 100000,
          unitPrice: 0.0175,
          price: 1500,
        },
        {
          events: 200000,
          unitPrice: 0.0175,
          price: 3200,
        },
        {
          events: 300000,
          unitPrice: 0.0175,
          price: 5000,
        },
        {
          events: 400000,
          unitPrice: 0.0175,
          price: 6700,
        },
        {
          events: 500000,
          unitPrice: 0.015,
          price: 8500,
        },
        {
          events: 1000000,
          unitPrice: 0.015,
          price: 16000,
        },
        {
          events: 1500000,
          unitPrice: 0.015,
          price: 23500,
        },
        {
          events: 2000000,
          unitPrice: 0.015,
          price: 31000,
        },
        {
          events: 3000000,
          unitPrice: 0.015,
          price: 46000,
        },
        {
          events: 4000000,
          unitPrice: 0.015,
          price: 61000,
        },
        {
          events: 5000000,
          unitPrice: 0.015,
          price: 76000,
        },
        {
          events: 6000000,
          unitPrice: 0.015,
          price: 91000,
        },
        {
          events: 7000000,
          unitPrice: 0.015,
          price: 106000,
        },
        {
          events: 8000000,
          unitPrice: 0.015,
          price: 121000,
        },
        {
          events: 9000000,
          unitPrice: 0.015,
          price: 136000,
        },
        {
          events: 10000000,
          unitPrice: 0.013,
          price: 151000,
        },
        {
          events: 11000000,
          unitPrice: 0.013,
          price: 164000,
        },
        {
          events: 12000000,
          unitPrice: 0.013,
          price: 177000,
        },
        {
          events: 13000000,
          unitPrice: 0.013,
          price: 190000,
        },
        {
          events: 14000000,
          unitPrice: 0.013,
          price: 203000,
        },
        {
          events: 15000000,
          unitPrice: 0.013,
          price: 216000,
        },
        {
          events: 16000000,
          price: 229000,
          unitPrice: 0.013,
        },
        {
          events: 17000000,
          price: 242000,
          unitPrice: 0.013,
        },
        {
          events: 18000000,
          price: 255000,
          unitPrice: 0.013,
        },
        {
          events: 19000000,
          price: 268000,
          unitPrice: 0.013,
        },
        {
          events: 20000000,
          price: 281000,
          unitPrice: 0.011,
        },
        {
          events: 21000000,
          price: 293000,
          unitPrice: 0.011,
        },
        {
          events: 22000000,
          price: 305000,
          unitPrice: 0.011,
        },
        {
          events: 23000000,
          price: 317000,
          unitPrice: 0.011,
        },
        {
          events: 24000000,
          price: 329000,
          unitPrice: 0.011,
        },
        {
          events: 25000000,
          price: 341000,
          unitPrice: 0.011,
        },
        {
          events: 30000000,
          price: 401000,
          unitPrice: 0.011,
        },
        {
          events: 35000000,
          price: 461000,
          unitPrice: 0.011,
        },
        {
          events: 40000000,
          price: 521000,
          unitPrice: 0.011,
        },
        {
          events: 45000000,
          price: 581000,
          unitPrice: 0.011,
        },
        {
          events: 50000000,
          price: 641000,
          unitPrice: 0.011,
        },
      ],
      transactions: [
        {
          events: 100000,
          unitPrice: 0.01,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0058,
          price: 1500,
        },
        {
          events: 500000,
          unitPrice: 0.0052,
          price: 3000,
        },
        {
          events: 1000000,
          unitPrice: 0.0052,
          price: 5600,
        },
        {
          events: 1500000,
          unitPrice: 0.0052,
          price: 8200,
        },
        {
          events: 2000000,
          unitPrice: 0.0052,
          price: 10800,
        },
        {
          events: 2500000,
          unitPrice: 0.0052,
          price: 13400,
        },
        {
          events: 3000000,
          unitPrice: 0.0052,
          price: 16000,
        },
        {
          events: 3500000,
          unitPrice: 0.0052,
          price: 18600,
        },
        {
          events: 4000000,
          unitPrice: 0.0052,
          price: 21200,
        },
        {
          events: 4500000,
          unitPrice: 0.0046,
          price: 23800,
        },
        {
          events: 5000000,
          unitPrice: 0.0046,
          price: 26100,
        },
        {
          events: 6000000,
          unitPrice: 0.0046,
          price: 30700,
        },
        {
          events: 7000000,
          unitPrice: 0.0046,
          price: 35300,
        },
        {
          events: 8000000,
          unitPrice: 0.0046,
          price: 39900,
        },
        {
          events: 9000000,
          unitPrice: 0.0046,
          price: 44500,
        },
        {
          events: 10000000,
          unitPrice: 0.0044,
          price: 49100,
        },
        {
          events: 12000000,
          unitPrice: 0.0044,
          price: 57900,
        },
        {
          events: 14000000,
          unitPrice: 0.0044,
          price: 66700,
        },
        {
          events: 16000000,
          unitPrice: 0.0044,
          price: 75500,
        },
        {
          events: 18000000,
          unitPrice: 0.0044,
          price: 84300,
        },
        {
          events: 20000000,
          unitPrice: 0.0042,
          price: 93100,
        },
        {
          events: 22000000,
          unitPrice: 0.0042,
          price: 101900,
        },
        {
          events: 24000000,
          unitPrice: 0.0042,
          price: 110700,
        },
        {
          events: 26000000,
          unitPrice: 0.0042,
          price: 119100,
        },
        {
          events: 28000000,
          unitPrice: 0.0042,
          price: 127500,
        },
        {
          events: 30000000,
          unitPrice: 0.0042,
          price: 135900,
        },
      ],
      replays: [
        {
          events: 500,
          unitPrice: 0.2925,
          price: 0,
        },
        {
          events: 10000,
          unitPrice: 0.288,
          price: 2900,
        },
        {
          events: 25000,
          unitPrice: 0.2865,
          price: 7200,
        },
        {
          events: 50000,
          unitPrice: 0.286,
          price: 14300,
        },
        {
          events: 75000,
          unitPrice: 0.2858,
          price: 21500,
        },
        {
          events: 100000,
          unitPrice: 0.2711,
          price: 28600,
        },
        {
          events: 200000,
          unitPrice: 0.2663,
          price: 54200,
        },
        {
          events: 300000,
          unitPrice: 0.2638,
          price: 79900,
        },
        {
          events: 400000,
          unitPrice: 0.2624,
          price: 105500,
        },
        {
          events: 500000,
          unitPrice: 0.2614,
          price: 131200,
        },
        {
          events: 600000,
          unitPrice: 0.2607,
          price: 156800,
        },
        {
          events: 700000,
          unitPrice: 0.2602,
          price: 182500,
        },
        {
          events: 800000,
          unitPrice: 0.2598,
          price: 208100,
        },
        {
          events: 900000,
          unitPrice: 0.2569,
          price: 233800,
        },
        {
          events: 1000000,
          unitPrice: 0.2482,
          price: 256900,
        },
        {
          events: 1500000,
          price: 372300,
          unitPrice: 0.2439,
        },
        {
          events: 2000000,
          price: 487700,
          unitPrice: 0.2413,
        },
        {
          events: 2500000,
          price: 603100,
          unitPrice: 0.2395,
        },
        {
          events: 3000000,
          price: 718500,
          unitPrice: 0.2383,
        },
        {
          events: 3500000,
          price: 833900,
          unitPrice: 0.2374,
        },
        {
          events: 4000000,
          price: 949300,
          unitPrice: 0.2366,
        },
        {
          events: 4500000,
          price: 1064700,
          unitPrice: 0.2326,
        },
        {
          events: 5000000,
          price: 1162800,
          unitPrice: 0.2265,
        },
        {
          events: 6000000,
          price: 1359000,
          unitPrice: 0.2222,
        },
        {
          events: 7000000,
          price: 1555200,
          unitPrice: 0.219,
        },
        {
          events: 8000000,
          price: 1751400,
          unitPrice: 0.2164,
        },
        {
          events: 9000000,
          price: 1947600,
          unitPrice: 0.2144,
        },
        {
          events: 10000000,
          price: 2143800,
          unitPrice: 0.2144,
        },
      ],
      attachments: [
        {
          events: 1,
          unitPrice: 25.0,
          price: 0,
        },
        {
          events: 25,
          unitPrice: 25.0,
          price: 600,
        },
        {
          events: 50,
          unitPrice: 25.0,
          price: 1200,
        },
        {
          events: 75,
          unitPrice: 25.0,
          price: 1800,
        },
        {
          events: 100,
          unitPrice: 25.0,
          price: 2400,
        },
        {
          events: 200,
          unitPrice: 25.0,
          price: 4700,
        },
        {
          events: 300,
          unitPrice: 25.0,
          price: 7000,
        },
        {
          events: 400,
          unitPrice: 25.0,
          price: 9300,
        },
        {
          events: 500,
          unitPrice: 25.0,
          price: 11600,
        },
        {
          events: 600,
          unitPrice: 25.0,
          price: 13900,
        },
        {
          events: 700,
          unitPrice: 25.0,
          price: 16300,
        },
        {
          events: 800,
          unitPrice: 25.0,
          price: 18600,
        },
        {
          events: 900,
          unitPrice: 25.0,
          price: 20900,
        },
        {
          events: 1000,
          unitPrice: 25.0,
          price: 23200,
        },
      ],
      monitorSeats: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
      uptime: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
    },
    features: AM1_TEAM_FEATURES,
  },
  am1_team_auf: {
    allowAdditionalReservedEvents: false,
    availableCategories: [],
    onDemandEventPrice: 0,
    reservedMinimum: 0,
    totalPrice: 0,
    id: 'am1_team_auf',
    name: 'Team',
    description: '',
    trialPlan: null,
    categoryDisplayNames: AM1_CATEGORY_DISPLAY_NAMES,
    categories: AM1_CATEGORIES,
    checkoutCategories: AM1_CATEGORIES,
    onDemandCategories: AM1_CATEGORIES,
    hasOnDemandModes: true,
    basePrice: 31200,
    price: 31200,
    maxMembers: null,
    allowOnDemand: true,
    userSelectable: true,
    retentionDays: 90,
    billingInterval: ANNUAL,
    contractInterval: ANNUAL,
    planCategories: {
      errors: [
        {
          events: 50000,
          unitPrice: 0.029,
          price: 0,
        },
        {
          events: 100000,
          unitPrice: 0.0175,
          price: 16800,
        },
        {
          events: 200000,
          unitPrice: 0.0175,
          price: 35200,
        },
        {
          events: 300000,
          unitPrice: 0.0175,
          price: 54600,
        },
        {
          events: 400000,
          unitPrice: 0.0175,
          price: 73000,
        },
        {
          events: 500000,
          unitPrice: 0.015,
          price: 92400,
        },
        {
          events: 1000000,
          unitPrice: 0.015,
          price: 173400,
        },
        {
          events: 1500000,
          unitPrice: 0.015,
          price: 254400,
        },
        {
          events: 2000000,
          unitPrice: 0.015,
          price: 335400,
        },
        {
          events: 3000000,
          unitPrice: 0.015,
          price: 497400,
        },
        {
          events: 4000000,
          unitPrice: 0.015,
          price: 659400,
        },
        {
          events: 5000000,
          unitPrice: 0.015,
          price: 821400,
        },
        {
          events: 6000000,
          unitPrice: 0.015,
          price: 983400,
        },
        {
          events: 7000000,
          unitPrice: 0.015,
          price: 1145400,
        },
        {
          events: 8000000,
          unitPrice: 0.015,
          price: 1307400,
        },
        {
          events: 9000000,
          unitPrice: 0.015,
          price: 1469400,
        },
        {
          events: 10000000,
          unitPrice: 0.013,
          price: 1631400,
        },
        {
          events: 11000000,
          unitPrice: 0.013,
          price: 1771800,
        },
        {
          events: 12000000,
          unitPrice: 0.013,
          price: 1912200,
        },
        {
          events: 13000000,
          unitPrice: 0.013,
          price: 2052600,
        },
        {
          events: 14000000,
          unitPrice: 0.013,
          price: 2193000,
        },
        {
          events: 15000000,
          unitPrice: 0.013,
          price: 2333400,
        },
        {
          events: 16000000,
          price: 2473800,
          unitPrice: 0.013,
        },
        {
          events: 17000000,
          price: 2614200,
          unitPrice: 0.013,
        },
        {
          events: 18000000,
          price: 2754600,
          unitPrice: 0.013,
        },
        {
          events: 19000000,
          price: 2895000,
          unitPrice: 0.013,
        },
        {
          events: 20000000,
          price: 3035400,
          unitPrice: 0.011,
        },
        {
          events: 21000000,
          price: 3165000,
          unitPrice: 0.011,
        },
        {
          events: 22000000,
          price: 3294600,
          unitPrice: 0.011,
        },
        {
          events: 23000000,
          price: 3424200,
          unitPrice: 0.011,
        },
        {
          events: 24000000,
          price: 3553800,
          unitPrice: 0.011,
        },
        {
          events: 25000000,
          price: 3683400,
          unitPrice: 0.011,
        },
        {
          events: 30000000,
          price: 4331400,
          unitPrice: 0.011,
        },
        {
          events: 35000000,
          price: 4979400,
          unitPrice: 0.011,
        },
        {
          events: 40000000,
          price: 5627400,
          unitPrice: 0.011,
        },
        {
          events: 45000000,
          price: 6275400,
          unitPrice: 0.011,
        },
        {
          events: 50000000,
          price: 6923400,
          unitPrice: 0.011,
        },
      ],
      transactions: [
        {
          events: 100000,
          unitPrice: 0.01,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0058,
          price: 16200,
        },
        {
          events: 500000,
          unitPrice: 0.0052,
          price: 32400,
        },
        {
          events: 1000000,
          unitPrice: 0.0052,
          price: 60500,
        },
        {
          events: 1500000,
          unitPrice: 0.0052,
          price: 88600,
        },
        {
          events: 2000000,
          unitPrice: 0.0052,
          price: 116700,
        },
        {
          events: 2500000,
          unitPrice: 0.0052,
          price: 144800,
        },
        {
          events: 3000000,
          unitPrice: 0.0052,
          price: 172900,
        },
        {
          events: 3500000,
          unitPrice: 0.0052,
          price: 201000,
        },
        {
          events: 4000000,
          unitPrice: 0.0052,
          price: 229100,
        },
        {
          events: 4500000,
          unitPrice: 0.0046,
          price: 257200,
        },
        {
          events: 5000000,
          unitPrice: 0.0046,
          price: 282000,
        },
        {
          events: 6000000,
          unitPrice: 0.0046,
          price: 331700,
        },
        {
          events: 7000000,
          unitPrice: 0.0046,
          price: 381400,
        },
        {
          events: 8000000,
          unitPrice: 0.0046,
          price: 431100,
        },
        {
          events: 9000000,
          unitPrice: 0.0046,
          price: 480800,
        },
        {
          events: 10000000,
          unitPrice: 0.0044,
          price: 530500,
        },
        {
          events: 12000000,
          unitPrice: 0.0044,
          price: 625500,
        },
        {
          events: 14000000,
          unitPrice: 0.0044,
          price: 720500,
        },
        {
          events: 16000000,
          unitPrice: 0.0044,
          price: 815500,
        },
        {
          events: 18000000,
          unitPrice: 0.0044,
          price: 910500,
        },
        {
          events: 20000000,
          unitPrice: 0.0042,
          price: 1005500,
        },
        {
          events: 22000000,
          unitPrice: 0.0042,
          price: 1100500,
        },
        {
          events: 24000000,
          unitPrice: 0.0042,
          price: 1195500,
        },
        {
          events: 26000000,
          unitPrice: 0.0042,
          price: 1286200,
        },
        {
          events: 28000000,
          unitPrice: 0.0042,
          price: 1376900,
        },
        {
          events: 30000000,
          unitPrice: 0.0042,
          price: 1467600,
        },
      ],
      replays: [
        {
          events: 500,
          unitPrice: 0.2925,
          price: 0,
        },
        {
          events: 10000,
          unitPrice: 0.288,
          price: 31200,
        },
        {
          events: 25000,
          unitPrice: 0.2865,
          price: 78000,
        },
        {
          events: 50000,
          unitPrice: 0.286,
          price: 154800,
        },
        {
          events: 75000,
          unitPrice: 0.2858,
          price: 232800,
        },
        {
          events: 100000,
          unitPrice: 0.2711,
          price: 308400,
        },
        {
          events: 200000,
          unitPrice: 0.2663,
          price: 585600,
        },
        {
          events: 300000,
          unitPrice: 0.2638,
          price: 862800,
        },
        {
          events: 400000,
          unitPrice: 0.2624,
          price: 1140000,
        },
        {
          events: 500000,
          unitPrice: 0.2614,
          price: 1417200,
        },
        {
          events: 600000,
          unitPrice: 0.2607,
          price: 1693200,
        },
        {
          events: 700000,
          unitPrice: 0.2602,
          price: 1971600,
        },
        {
          events: 800000,
          unitPrice: 0.2598,
          price: 2247600,
        },
        {
          events: 900000,
          unitPrice: 0.2569,
          price: 2524800,
        },
        {
          events: 1000000,
          unitPrice: 0.2482,
          price: 2774400,
        },
        {
          events: 1500000,
          price: 4021200,
          unitPrice: 0.2439,
        },
        {
          events: 2000000,
          price: 5266800,
          unitPrice: 0.2413,
        },
        {
          events: 2500000,
          price: 6513600,
          unitPrice: 0.2395,
        },
        {
          events: 3000000,
          price: 7760400,
          unitPrice: 0.2383,
        },
        {
          events: 3500000,
          price: 9006000,
          unitPrice: 0.2374,
        },
        {
          events: 4000000,
          price: 10252800,
          unitPrice: 0.2366,
        },
        {
          events: 4500000,
          price: 11498400,
          unitPrice: 0.2326,
        },
        {
          events: 5000000,
          price: 12558000,
          unitPrice: 0.2265,
        },
        {
          events: 6000000,
          price: 14677200,
          unitPrice: 0.2222,
        },
        {
          events: 7000000,
          price: 16796400,
          unitPrice: 0.219,
        },
        {
          events: 8000000,
          price: 18915600,
          unitPrice: 0.2164,
        },
        {
          events: 9000000,
          price: 21033600,
          unitPrice: 0.2144,
        },
        {
          events: 10000000,
          price: 23152800,
          unitPrice: 0.2144,
        },
      ],
      attachments: [
        {
          events: 1,
          unitPrice: 25.0,
          price: 0,
        },
        {
          events: 25,
          unitPrice: 25.0,
          price: 6300,
        },
        {
          events: 50,
          unitPrice: 25.0,
          price: 12500,
        },
        {
          events: 75,
          unitPrice: 25.0,
          price: 18800,
        },
        {
          events: 100,
          unitPrice: 25.0,
          price: 25000,
        },
        {
          events: 200,
          unitPrice: 25.0,
          price: 50000,
        },
        {
          events: 300,
          unitPrice: 25.0,
          price: 75000,
        },
        {
          events: 400,
          unitPrice: 25.0,
          price: 100000,
        },
        {
          events: 500,
          unitPrice: 25.0,
          price: 125000,
        },
        {
          events: 600,
          unitPrice: 25.0,
          price: 150000,
        },
        {
          events: 700,
          unitPrice: 25.0,
          price: 175000,
        },
        {
          events: 800,
          unitPrice: 25.0,
          price: 200000,
        },
        {
          events: 900,
          unitPrice: 25.0,
          price: 225000,
        },
        {
          events: 1000,
          unitPrice: 25.0,
          price: 250000,
        },
      ],
      monitorSeats: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
      uptime: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
    },
    features: AM1_TEAM_FEATURES,
  },
  am1_business: {
    allowAdditionalReservedEvents: false,
    availableCategories: [],
    onDemandEventPrice: 0,
    reservedMinimum: 0,
    totalPrice: 0,
    id: 'am1_business',
    name: 'Business',
    description: '',
    trialPlan: null,
    categoryDisplayNames: AM1_CATEGORY_DISPLAY_NAMES,
    categories: AM1_CATEGORIES,
    checkoutCategories: AM1_CATEGORIES,
    onDemandCategories: AM1_CATEGORIES,
    hasOnDemandModes: true,
    maxMembers: null,
    basePrice: 8900,
    price: 8900,
    allowOnDemand: true,
    userSelectable: true,
    retentionDays: 90,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    planCategories: {
      errors: [
        {
          events: 50000,
          unitPrice: 0.089,
          price: 0,
        },
        {
          events: 100000,
          unitPrice: 0.05,
          price: 4500,
        },
        {
          events: 200000,
          unitPrice: 0.05,
          price: 9500,
        },
        {
          events: 300000,
          unitPrice: 0.05,
          price: 14500,
        },
        {
          events: 400000,
          unitPrice: 0.05,
          price: 19500,
        },
        {
          events: 500000,
          unitPrice: 0.03,
          price: 24500,
        },
        {
          events: 1000000,
          unitPrice: 0.03,
          price: 39500,
        },
        {
          events: 1500000,
          unitPrice: 0.03,
          price: 54500,
        },
        {
          events: 2000000,
          unitPrice: 0.03,
          price: 69500,
        },
        {
          events: 3000000,
          unitPrice: 0.03,
          price: 99500,
        },
        {
          events: 4000000,
          unitPrice: 0.03,
          price: 129500,
        },
        {
          events: 5000000,
          unitPrice: 0.03,
          price: 159500,
        },
        {
          events: 6000000,
          unitPrice: 0.03,
          price: 189500,
        },
        {
          events: 7000000,
          unitPrice: 0.03,
          price: 219500,
        },
        {
          events: 8000000,
          unitPrice: 0.03,
          price: 249500,
        },
        {
          events: 9000000,
          unitPrice: 0.03,
          price: 279500,
        },
        {
          events: 10000000,
          unitPrice: 0.0251,
          price: 309500,
        },
        {
          events: 11000000,
          unitPrice: 0.0251,
          price: 334500,
        },
        {
          events: 12000000,
          unitPrice: 0.0251,
          price: 359500,
        },
        {
          events: 13000000,
          unitPrice: 0.0251,
          price: 384500,
        },
        {
          events: 14000000,
          unitPrice: 0.0251,
          price: 409500,
        },
        {
          events: 15000000,
          unitPrice: 0.0251,
          price: 434500,
        },
        {
          events: 16000000,
          price: 459500,
          unitPrice: 0.0251,
        },
        {
          events: 17000000,
          price: 484500,
          unitPrice: 0.0251,
        },
        {
          events: 18000000,
          price: 509500,
          unitPrice: 0.0251,
        },
        {
          events: 19000000,
          price: 534500,
          unitPrice: 0.0251,
        },
        {
          events: 20000000,
          price: 559500,
          unitPrice: 0.0132,
        },
        {
          events: 21000000,
          price: 573900,
          unitPrice: 0.0132,
        },
        {
          events: 22000000,
          price: 588300,
          unitPrice: 0.0132,
        },
        {
          events: 23000000,
          price: 602700,
          unitPrice: 0.0132,
        },
        {
          events: 24000000,
          price: 617100,
          unitPrice: 0.0132,
        },
        {
          events: 25000000,
          price: 631500,
          unitPrice: 0.0132,
        },
        {
          events: 30000000,
          price: 703500,
          unitPrice: 0.0132,
        },
        {
          events: 35000000,
          price: 775500,
          unitPrice: 0.0132,
        },
        {
          events: 40000000,
          price: 847500,
          unitPrice: 0.0132,
        },
        {
          events: 45000000,
          price: 919500,
          unitPrice: 0.0132,
        },
        {
          events: 50000000,
          price: 991500,
          unitPrice: 0.0132,
        },
      ],
      transactions: [
        {
          events: 100000,
          unitPrice: 0.03,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0178,
          price: 4500,
        },
        {
          events: 500000,
          unitPrice: 0.013,
          price: 9000,
        },
        {
          events: 1000000,
          unitPrice: 0.013,
          price: 15500,
        },
        {
          events: 1500000,
          unitPrice: 0.013,
          price: 22000,
        },
        {
          events: 2000000,
          unitPrice: 0.013,
          price: 28500,
        },
        {
          events: 2500000,
          unitPrice: 0.013,
          price: 35000,
        },
        {
          events: 3000000,
          unitPrice: 0.013,
          price: 41500,
        },
        {
          events: 3500000,
          unitPrice: 0.013,
          price: 48000,
        },
        {
          events: 4000000,
          unitPrice: 0.013,
          price: 54500,
        },
        {
          events: 4500000,
          unitPrice: 0.0092,
          price: 61000,
        },
        {
          events: 5000000,
          unitPrice: 0.0092,
          price: 65600,
        },
        {
          events: 6000000,
          unitPrice: 0.0092,
          price: 74800,
        },
        {
          events: 7000000,
          unitPrice: 0.0092,
          price: 84000,
        },
        {
          events: 8000000,
          unitPrice: 0.0092,
          price: 93200,
        },
        {
          events: 9000000,
          unitPrice: 0.0092,
          price: 102400,
        },
        {
          events: 10000000,
          unitPrice: 0.0077,
          price: 111600,
        },
        {
          events: 12000000,
          unitPrice: 0.0077,
          price: 127000,
        },
        {
          events: 14000000,
          unitPrice: 0.0077,
          price: 142400,
        },
        {
          events: 16000000,
          unitPrice: 0.0077,
          price: 157800,
        },
        {
          events: 18000000,
          unitPrice: 0.0077,
          price: 173200,
        },
        {
          events: 20000000,
          unitPrice: 0.0074,
          price: 188600,
        },
        {
          events: 22000000,
          unitPrice: 0.0074,
          price: 204000,
        },
        {
          events: 24000000,
          unitPrice: 0.0074,
          price: 219400,
        },
        {
          events: 26000000,
          unitPrice: 0.0074,
          price: 234100,
        },
        {
          events: 28000000,
          unitPrice: 0.0074,
          price: 248800,
        },
        {
          events: 30000000,
          unitPrice: 0.0074,
          price: 263500,
        },
      ],
      replays: [
        {
          events: 500,
          unitPrice: 0.2925,
          price: 0,
        },
        {
          events: 10000,
          unitPrice: 0.288,
          price: 2900,
        },
        {
          events: 25000,
          unitPrice: 0.2865,
          price: 7200,
        },
        {
          events: 50000,
          unitPrice: 0.286,
          price: 14300,
        },
        {
          events: 75000,
          unitPrice: 0.2858,
          price: 21500,
        },
        {
          events: 100000,
          unitPrice: 0.2711,
          price: 28600,
        },
        {
          events: 200000,
          unitPrice: 0.2663,
          price: 54200,
        },
        {
          events: 300000,
          unitPrice: 0.2638,
          price: 79900,
        },
        {
          events: 400000,
          unitPrice: 0.2624,
          price: 105500,
        },
        {
          events: 500000,
          unitPrice: 0.2614,
          price: 131200,
        },
        {
          events: 600000,
          unitPrice: 0.2607,
          price: 156800,
        },
        {
          events: 700000,
          unitPrice: 0.2602,
          price: 182500,
        },
        {
          events: 800000,
          unitPrice: 0.2598,
          price: 208100,
        },
        {
          events: 900000,
          unitPrice: 0.2569,
          price: 233800,
        },
        {
          events: 1000000,
          unitPrice: 0.2482,
          price: 256900,
        },
        {
          events: 1500000,
          price: 372300,
          unitPrice: 0.2439,
        },
        {
          events: 2000000,
          price: 487700,
          unitPrice: 0.2413,
        },
        {
          events: 2500000,
          price: 603100,
          unitPrice: 0.2395,
        },
        {
          events: 3000000,
          price: 718500,
          unitPrice: 0.2383,
        },
        {
          events: 3500000,
          price: 833900,
          unitPrice: 0.2374,
        },
        {
          events: 4000000,
          price: 949300,
          unitPrice: 0.2366,
        },
        {
          events: 4500000,
          price: 1064700,
          unitPrice: 0.2326,
        },
        {
          events: 5000000,
          price: 1162800,
          unitPrice: 0.2265,
        },
        {
          events: 6000000,
          price: 1359000,
          unitPrice: 0.2222,
        },
        {
          events: 7000000,
          price: 1555200,
          unitPrice: 0.219,
        },
        {
          events: 8000000,
          price: 1751400,
          unitPrice: 0.2164,
        },
        {
          events: 9000000,
          price: 1947600,
          unitPrice: 0.2144,
        },
        {
          events: 10000000,
          price: 2143800,
          unitPrice: 0.2144,
        },
      ],
      attachments: [
        {
          events: 1,
          unitPrice: 25.0,
          price: 0,
        },
        {
          events: 25,
          unitPrice: 25.0,
          price: 600,
        },
        {
          events: 50,
          unitPrice: 25.0,
          price: 1200,
        },
        {
          events: 75,
          unitPrice: 25.0,
          price: 1800,
        },
        {
          events: 100,
          unitPrice: 25.0,
          price: 2400,
        },
        {
          events: 200,
          unitPrice: 25.0,
          price: 4700,
        },
        {
          events: 300,
          unitPrice: 25.0,
          price: 7000,
        },
        {
          events: 400,
          unitPrice: 25.0,
          price: 9300,
        },
        {
          events: 500,
          unitPrice: 25.0,
          price: 11600,
        },
        {
          events: 600,
          unitPrice: 25.0,
          price: 13900,
        },
        {
          events: 700,
          unitPrice: 25.0,
          price: 16300,
        },
        {
          events: 800,
          unitPrice: 25.0,
          price: 18600,
        },
        {
          events: 900,
          unitPrice: 25.0,
          price: 20900,
        },
        {
          events: 1000,
          unitPrice: 25.0,
          price: 23200,
        },
      ],
      monitorSeats: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
      uptime: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
    },
    features: AM1_BUSINESS_FEATURES,
  },
  am1_business_auf: {
    allowAdditionalReservedEvents: false,
    availableCategories: [],
    onDemandEventPrice: 0,
    reservedMinimum: 0,
    totalPrice: 0,
    id: 'am1_business_auf',
    name: 'Business',
    description: '',
    trialPlan: null,
    basePrice: 96000,
    categoryDisplayNames: AM1_CATEGORY_DISPLAY_NAMES,
    categories: AM1_CATEGORIES,
    checkoutCategories: AM1_CATEGORIES,
    onDemandCategories: AM1_CATEGORIES,
    hasOnDemandModes: true,
    price: 96000,
    maxMembers: null,
    allowOnDemand: true,
    userSelectable: true,
    retentionDays: 90,
    billingInterval: ANNUAL,
    contractInterval: ANNUAL,
    planCategories: {
      errors: [
        {
          events: 50000,
          unitPrice: 0.089,
          price: 0,
        },
        {
          events: 100000,
          unitPrice: 0.05,
          price: 49200,
        },
        {
          events: 200000,
          unitPrice: 0.05,
          price: 103200,
        },
        {
          events: 300000,
          unitPrice: 0.05,
          price: 157200,
        },
        {
          events: 400000,
          unitPrice: 0.05,
          price: 211200,
        },
        {
          events: 500000,
          unitPrice: 0.03,
          price: 265200,
        },
        {
          events: 1000000,
          unitPrice: 0.03,
          price: 427200,
        },
        {
          events: 1500000,
          unitPrice: 0.03,
          price: 589200,
        },
        {
          events: 2000000,
          unitPrice: 0.03,
          price: 751200,
        },
        {
          events: 3000000,
          unitPrice: 0.03,
          price: 1075200,
        },
        {
          events: 4000000,
          unitPrice: 0.03,
          price: 1399200,
        },
        {
          events: 5000000,
          unitPrice: 0.03,
          price: 1723200,
        },
        {
          events: 6000000,
          unitPrice: 0.03,
          price: 2047200,
        },
        {
          events: 7000000,
          unitPrice: 0.03,
          price: 2371200,
        },
        {
          events: 8000000,
          unitPrice: 0.03,
          price: 2695200,
        },
        {
          events: 9000000,
          unitPrice: 0.03,
          price: 3019200,
        },
        {
          events: 10000000,
          unitPrice: 0.0251,
          price: 3343200,
        },
        {
          events: 11000000,
          unitPrice: 0.0251,
          price: 3613200,
        },
        {
          events: 12000000,
          unitPrice: 0.0251,
          price: 3883200,
        },
        {
          events: 13000000,
          unitPrice: 0.0251,
          price: 4153200,
        },
        {
          events: 14000000,
          unitPrice: 0.0251,
          price: 4423200,
        },
        {
          events: 15000000,
          unitPrice: 0.0251,
          price: 4693200,
        },
        {
          events: 16000000,
          price: 4963200,
          unitPrice: 0.0251,
        },
        {
          events: 17000000,
          price: 5233200,
          unitPrice: 0.0251,
        },
        {
          events: 18000000,
          price: 5503200,
          unitPrice: 0.0251,
        },
        {
          events: 19000000,
          price: 5773200,
          unitPrice: 0.0251,
        },
        {
          events: 20000000,
          price: 6043200,
          unitPrice: 0.0132,
        },
        {
          events: 21000000,
          price: 6198700,
          unitPrice: 0.0132,
        },
        {
          events: 22000000,
          price: 6354200,
          unitPrice: 0.0132,
        },
        {
          events: 23000000,
          price: 6509700,
          unitPrice: 0.0132,
        },
        {
          events: 24000000,
          price: 6665200,
          unitPrice: 0.0132,
        },
        {
          events: 25000000,
          price: 6820700,
          unitPrice: 0.0132,
        },
        {
          events: 30000000,
          price: 7598300,
          unitPrice: 0.0132,
        },
        {
          events: 35000000,
          price: 8375900,
          unitPrice: 0.0132,
        },
        {
          events: 40000000,
          price: 9153500,
          unitPrice: 0.0132,
        },
        {
          events: 45000000,
          price: 9931100,
          unitPrice: 0.0132,
        },
        {
          events: 50000000,
          price: 10708700,
          unitPrice: 0.0132,
        },
      ],
      transactions: [
        {
          events: 100000,
          unitPrice: 0.03,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0178,
          price: 48600,
        },
        {
          events: 500000,
          unitPrice: 0.013,
          price: 97200,
        },
        {
          events: 1000000,
          unitPrice: 0.013,
          price: 167400,
        },
        {
          events: 1500000,
          unitPrice: 0.013,
          price: 237600,
        },
        {
          events: 2000000,
          unitPrice: 0.013,
          price: 307800,
        },
        {
          events: 2500000,
          unitPrice: 0.013,
          price: 378000,
        },
        {
          events: 3000000,
          unitPrice: 0.013,
          price: 448200,
        },
        {
          events: 3500000,
          unitPrice: 0.013,
          price: 518400,
        },
        {
          events: 4000000,
          unitPrice: 0.013,
          price: 588600,
        },
        {
          events: 4500000,
          unitPrice: 0.0092,
          price: 658800,
        },
        {
          events: 5000000,
          unitPrice: 0.0092,
          price: 708500,
        },
        {
          events: 6000000,
          unitPrice: 0.0092,
          price: 807900,
        },
        {
          events: 7000000,
          unitPrice: 0.0092,
          price: 907300,
        },
        {
          events: 8000000,
          unitPrice: 0.0092,
          price: 1006700,
        },
        {
          events: 9000000,
          unitPrice: 0.0092,
          price: 1106100,
        },
        {
          events: 10000000,
          unitPrice: 0.0077,
          price: 1205500,
        },
        {
          events: 12000000,
          unitPrice: 0.0077,
          price: 1371800,
        },
        {
          events: 14000000,
          unitPrice: 0.0077,
          price: 1538100,
        },
        {
          events: 16000000,
          unitPrice: 0.0077,
          price: 1704400,
        },
        {
          events: 18000000,
          unitPrice: 0.0077,
          price: 1870700,
        },
        {
          events: 20000000,
          unitPrice: 0.0074,
          price: 2037000,
        },
        {
          events: 22000000,
          unitPrice: 0.0074,
          price: 2203300,
        },
        {
          events: 24000000,
          unitPrice: 0.0074,
          price: 2369600,
        },
        {
          events: 26000000,
          unitPrice: 0.0074,
          price: 2528400,
        },
        {
          events: 28000000,
          unitPrice: 0.0074,
          price: 2687200,
        },
        {
          events: 30000000,
          unitPrice: 0.0074,
          price: 2846000,
        },
      ],
      replays: [
        {
          events: 500,
          price: 0,
          unitPrice: 0.2925,
        },
        {
          events: 10000,
          price: 31200,
          unitPrice: 0.288,
        },
        {
          events: 25000,
          price: 78000,
          unitPrice: 0.2865,
        },
        {
          events: 50000,
          price: 154800,
          unitPrice: 0.286,
        },
        {
          events: 75000,
          price: 232800,
          unitPrice: 0.2858,
        },
        {
          events: 100000,
          price: 308400,
          unitPrice: 0.2711,
        },
        {
          events: 200000,
          price: 585600,
          unitPrice: 0.2663,
        },
        {
          events: 300000,
          price: 862800,
          unitPrice: 0.2638,
        },
        {
          events: 400000,
          price: 1140000,
          unitPrice: 0.2624,
        },
        {
          events: 500000,
          price: 1417200,
          unitPrice: 0.2614,
        },
        {
          events: 600000,
          price: 1693200,
          unitPrice: 0.2607,
        },
        {
          events: 700000,
          price: 1971600,
          unitPrice: 0.2602,
        },
        {
          events: 800000,
          price: 2247600,
          unitPrice: 0.2598,
        },
        {
          events: 900000,
          price: 2524800,
          unitPrice: 0.2569,
        },
        {
          events: 1000000,
          price: 2774400,
          unitPrice: 0.2482,
        },
        {
          events: 1500000,
          price: 4021200,
          unitPrice: 0.2439,
        },
        {
          events: 2000000,
          price: 5266800,
          unitPrice: 0.2413,
        },
        {
          events: 2500000,
          price: 6513600,
          unitPrice: 0.2395,
        },
        {
          events: 3000000,
          price: 7760400,
          unitPrice: 0.2383,
        },
        {
          events: 3500000,
          price: 9006000,
          unitPrice: 0.2374,
        },
        {
          events: 4000000,
          price: 10252800,
          unitPrice: 0.2366,
        },
        {
          events: 4500000,
          price: 11498400,
          unitPrice: 0.2326,
        },
        {
          events: 5000000,
          price: 12558000,
          unitPrice: 0.2265,
        },
        {
          events: 6000000,
          price: 14677200,
          unitPrice: 0.2222,
        },
        {
          events: 7000000,
          price: 16796400,
          unitPrice: 0.219,
        },
        {
          events: 8000000,
          price: 18915600,
          unitPrice: 0.2164,
        },
        {
          events: 9000000,
          price: 21033600,
          unitPrice: 0.2144,
        },
        {
          events: 10000000,
          price: 23152800,
          unitPrice: 0.2144,
        },
      ],
      attachments: [
        {
          events: 1,
          unitPrice: 25.0,
          price: 0,
        },
        {
          events: 25,
          unitPrice: 25.0,
          price: 6300,
        },
        {
          events: 50,
          unitPrice: 25.0,
          price: 12500,
        },
        {
          events: 75,
          unitPrice: 25.0,
          price: 18800,
        },
        {
          events: 100,
          unitPrice: 25.0,
          price: 25000,
        },
        {
          events: 200,
          unitPrice: 25.0,
          price: 50000,
        },
        {
          events: 300,
          unitPrice: 25.0,
          price: 75000,
        },
        {
          events: 400,
          unitPrice: 25.0,
          price: 100000,
        },
        {
          events: 500,
          unitPrice: 25.0,
          price: 125000,
        },
        {
          events: 600,
          unitPrice: 25.0,
          price: 150000,
        },
        {
          events: 700,
          unitPrice: 25.0,
          price: 175000,
        },
        {
          events: 800,
          unitPrice: 25.0,
          price: 200000,
        },
        {
          events: 900,
          unitPrice: 25.0,
          price: 225000,
        },
        {
          events: 1000,
          unitPrice: 25.0,
          price: 250000,
        },
      ],
      monitorSeats: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
      uptime: [
        {
          price: 0,
          unitPrice: 60,
          events: 1,
        },
      ],
    },
    features: AM1_BUSINESS_FEATURES,
  },
};

export default AM1_PLANS;
