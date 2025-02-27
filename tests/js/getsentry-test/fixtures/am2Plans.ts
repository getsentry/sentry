import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {Plan} from 'getsentry/types';
import {CheckoutType} from 'getsentry/types';

const AM2_CATEGORIES = [
  'errors',
  'transactions',
  'replays',
  'attachments',
  'monitorSeats',
  'profileDuration',
  'uptime',
];

const AM2_CATEGORY_DISPLAY_NAMES = {
  errors: {singular: 'error', plural: 'errors'},
  transactions: {singular: 'performance unit', plural: 'performance units'},
  replays: {singular: 'replay', plural: 'replays'},
  attachments: {singular: 'attachment', plural: 'attachments'},
  monitorSeats: {singular: 'cron monitor', plural: 'cron monitors'},
  profileDuration: {plural: 'profile hours', singular: 'profile hour'},
  uptime: {singular: 'uptime monitor', plural: 'uptime monitors'},
};

const AM2_FREE_FEATURES = [
  'advanced-search',
  'integrations-stacktrace-link',
  'dynamic-sampling',
  'performance-view',
  'profiling-view',
  'session-replay',
  'monitor-seat-billing',
  'event-attachments',
];

const AM2_TEAM_FEATURES = [
  ...AM2_FREE_FEATURES,
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

const AM2_BUSINESS_FEATURES = [
  ...AM2_TEAM_FEATURES,
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

const AM2_TRIAL_FEATURES = AM2_BUSINESS_FEATURES.filter(
  feature => feature !== 'sso-saml2' && feature !== 'baa'
);

// TODO: Update with correct pricing and structure
const AM2_PLANS: Record<string, Plan> = {
  am2_business: {
    id: 'am2_business',
    name: 'Business',
    description: '',
    price: 8900,
    basePrice: 8900,
    totalPrice: 8900,
    trialPlan: null,
    maxMembers: null,
    retentionDays: 90,
    userSelectable: true,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_BUSINESS_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0.1157,
    allowOnDemand: true,
    reservedMinimum: 50000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
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
          unitPrice: 0.0251,
          price: 459500,
        },
        {
          events: 17000000,
          unitPrice: 0.0251,
          price: 484500,
        },
        {
          events: 18000000,
          unitPrice: 0.0251,
          price: 509500,
        },
        {
          events: 19000000,
          unitPrice: 0.0251,
          price: 534500,
        },
        {
          events: 20000000,
          unitPrice: 0.0132,
          price: 559500,
        },
        {
          events: 21000000,
          unitPrice: 0.0132,
          price: 573900,
        },
        {
          events: 22000000,
          unitPrice: 0.0132,
          price: 588300,
        },
        {
          events: 23000000,
          unitPrice: 0.0132,
          price: 602700,
        },
        {
          events: 24000000,
          unitPrice: 0.0132,
          price: 617100,
        },
        {
          events: 25000000,
          unitPrice: 0.0132,
          price: 631500,
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
          unitPrice: 0.0445,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0358,
          price: 4500,
        },
        {
          events: 500000,
          unitPrice: 0.0268,
          price: 9000,
        },
        {
          events: 1000000,
          unitPrice: 0.0199,
          price: 15500,
        },
        {
          events: 1500000,
          unitPrice: 0.0176,
          price: 22000,
        },
        {
          events: 2000000,
          unitPrice: 0.0165,
          price: 28500,
        },
        {
          events: 2500000,
          unitPrice: 0.0158,
          price: 35000,
        },
        {
          events: 3000000,
          unitPrice: 0.0153,
          price: 41500,
        },
        {
          events: 3500000,
          unitPrice: 0.015,
          price: 48000,
        },
        {
          events: 4000000,
          unitPrice: 0.0147,
          price: 54500,
        },
        {
          events: 4500000,
          unitPrice: 0.0145,
          price: 61000,
        },
        {
          events: 5000000,
          unitPrice: 0.014,
          price: 65600,
        },
        {
          events: 5500000,
          unitPrice: 0.0134,
          price: 69300,
        },
        {
          events: 6000000,
          unitPrice: 0.0129,
          price: 73000,
        },
        {
          events: 6500000,
          unitPrice: 0.0125,
          price: 76700,
        },
        {
          events: 7000000,
          unitPrice: 0.0121,
          price: 80400,
        },
        {
          events: 7500000,
          unitPrice: 0.0118,
          price: 84100,
        },
        {
          events: 8000000,
          unitPrice: 0.0115,
          price: 87800,
        },
        {
          events: 8500000,
          unitPrice: 0.0113,
          price: 91500,
        },
        {
          events: 9000000,
          unitPrice: 0.011,
          price: 95200,
        },
        {
          events: 9500000,
          unitPrice: 0.0109,
          price: 98900,
        },
        {
          events: 10000000,
          unitPrice: 0.0107,
          price: 102600,
        },
        {
          events: 15000000,
          unitPrice: 0.0085,
          price: 122800,
        },
        {
          events: 20000000,
          unitPrice: 0.0074,
          price: 143000,
        },
        {
          events: 25000000,
          unitPrice: 0.0067,
          price: 163200,
        },
        {
          events: 30000000,
          unitPrice: 0.0063,
          price: 183400,
        },
        {
          events: 35000000,
          unitPrice: 0.0059,
          price: 203600,
        },
        {
          events: 40000000,
          unitPrice: 0.0057,
          price: 223800,
        },
        {
          events: 45000000,
          unitPrice: 0.0055,
          price: 244000,
        },
        {
          events: 50000000,
          unitPrice: 0.0054,
          price: 264200,
        },
        {
          events: 55000000,
          unitPrice: 0.0053,
          price: 284400,
        },
        {
          events: 60000000,
          unitPrice: 0.0052,
          price: 304600,
        },
        {
          events: 65000000,
          unitPrice: 0.0051,
          price: 324800,
        },
        {
          events: 70000000,
          unitPrice: 0.005,
          price: 345000,
        },
        {
          events: 75000000,
          unitPrice: 0.0049,
          price: 365200,
        },
        {
          events: 80000000,
          unitPrice: 0.0049,
          price: 385400,
        },
        {
          events: 85000000,
          unitPrice: 0.0048,
          price: 405600,
        },
        {
          events: 90000000,
          unitPrice: 0.0048,
          price: 425800,
        },
        {
          events: 95000000,
          unitPrice: 0.0047,
          price: 446000,
        },
        {
          events: 100000000,
          unitPrice: 0.0047,
          price: 466200,
        },
        {
          events: 125000000,
          unitPrice: 0.0047,
          price: 547200,
        },
        {
          events: 150000000,
          unitPrice: 0.0037,
          price: 628200,
        },
        {
          events: 175000000,
          price: 709200,
          unitPrice: 0.0037,
        },
        {
          events: 200000000,
          price: 790200,
          unitPrice: 0.0032,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_f: {
    id: 'am2_f',
    name: 'Developer',
    description: '',
    price: 0,
    basePrice: 0,
    totalPrice: 0,
    trialPlan: 'am2_t',
    maxMembers: 1,
    retentionDays: 30,
    userSelectable: true,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_FREE_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0,
    allowOnDemand: false,
    reservedMinimum: 5000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [
        {
          events: 5000,
          unitPrice: 0,
          price: 0,
        },
      ],
      transactions: [
        {
          events: 10000,
          unitPrice: 0,
          price: 0,
        },
      ],
      replays: [
        {
          events: 50,
          unitPrice: 0,
          price: 0,
        },
      ],
      attachments: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      monitorSeats: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_team: {
    id: 'am2_team',
    name: 'Team',
    description: '',
    price: 2900,
    basePrice: 2900,
    totalPrice: 2900,
    trialPlan: 'am2_business',
    maxMembers: null,
    retentionDays: 90,
    userSelectable: true,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_TEAM_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0.0377,
    allowOnDemand: true,
    reservedMinimum: 50000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
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
          unitPrice: 0.0145,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0118,
          price: 1500,
        },
        {
          events: 500000,
          unitPrice: 0.0088,
          price: 3000,
        },
        {
          events: 1000000,
          unitPrice: 0.007,
          price: 5600,
        },
        {
          events: 1500000,
          unitPrice: 0.0064,
          price: 8200,
        },
        {
          events: 2000000,
          unitPrice: 0.0061,
          price: 10800,
        },
        {
          events: 2500000,
          unitPrice: 0.0059,
          price: 13400,
        },
        {
          events: 3000000,
          unitPrice: 0.0058,
          price: 16000,
        },
        {
          events: 3500000,
          unitPrice: 0.0057,
          price: 18600,
        },
        {
          events: 4000000,
          unitPrice: 0.0057,
          price: 21200,
        },
        {
          events: 4500000,
          unitPrice: 0.0056,
          price: 23800,
        },
        {
          events: 5000000,
          unitPrice: 0.0055,
          price: 26100,
        },
        {
          events: 5500000,
          unitPrice: 0.0054,
          price: 28100,
        },
        {
          events: 6000000,
          unitPrice: 0.0054,
          price: 30100,
        },
        {
          events: 6500000,
          unitPrice: 0.0054,
          price: 32100,
        },
        {
          events: 7000000,
          unitPrice: 0.0054,
          price: 34100,
        },
        {
          events: 7500000,
          unitPrice: 0.0054,
          price: 36100,
        },
        {
          events: 8000000,
          unitPrice: 0.0054,
          price: 38100,
        },
        {
          events: 8500000,
          unitPrice: 0.0054,
          price: 40100,
        },
        {
          events: 9000000,
          unitPrice: 0.0054,
          price: 42100,
        },
        {
          events: 9500000,
          unitPrice: 0.0054,
          price: 44100,
        },
        {
          events: 10000000,
          unitPrice: 0.0054,
          price: 46100,
        },
        {
          events: 15000000,
          unitPrice: 0.004,
          price: 598_00,
        },
        {
          events: 20000000,
          unitPrice: 0.004,
          price: 735_00,
        },
        {
          events: 25000000,
          unitPrice: 0.004,
          price: 872_00,
        },
        {
          events: 30000000,
          unitPrice: 0.004,
          price: 1009_00,
        },
        {
          events: 35000000,
          unitPrice: 0.004,
          price: 1146_00,
        },
        {
          events: 40000000,
          unitPrice: 0.004,
          price: 1283_00,
        },
        {
          events: 45000000,
          unitPrice: 0.004,
          price: 1420_00,
        },
        {
          events: 50000000,
          unitPrice: 0.004,
          price: 1557_00,
        },
        {
          events: 55000000,
          unitPrice: 0.004,
          price: 1694_00,
        },
        {
          events: 60000000,
          unitPrice: 0.004,
          price: 1831_00,
        },
        {
          events: 65000000,
          unitPrice: 0.004,
          price: 1968_00,
        },
        {
          events: 70000000,
          unitPrice: 0.004,
          price: 2105_00,
        },
        {
          events: 75000000,
          unitPrice: 0.004,
          price: 2242_00,
        },
        {
          events: 80000000,
          unitPrice: 0.004,
          price: 2379_00,
        },
        {
          events: 85000000,
          unitPrice: 0.004,
          price: 2516_00,
        },
        {
          events: 90000000,
          unitPrice: 0.004,
          price: 2653_00,
        },
        {
          events: 95000000,
          unitPrice: 0.004,
          price: 2790_00,
        },
        {
          events: 100000000,
          unitPrice: 0.004,
          price: 2927_00,
        },
        {
          events: 125_000_000,
          unitPrice: 0.0027,
          price: 3406_00,
        },
        {
          events: 150_000_000,
          unitPrice: 0.0026,
          price: 3885_00,
        },
        {
          events: 175_000_000,
          unitPrice: 0.0025,
          price: 4364_00,
        },
        {
          events: 200_000_000,
          unitPrice: 0.0024,
          price: 4843_00,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_t: {
    id: 'am2_t',
    name: 'Trial',
    description: '',
    price: 0,
    basePrice: 0,
    totalPrice: 0,
    trialPlan: null,
    maxMembers: 20,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_TRIAL_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0,
    allowOnDemand: false,
    reservedMinimum: 0,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      transactions: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      replays: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      attachments: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      monitorSeats: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_team_auf: {
    id: 'am2_team_auf',
    name: 'Team',
    description: '',
    price: 31200,
    basePrice: 31200,
    totalPrice: 31200,
    trialPlan: 'am2_business',
    maxMembers: null,
    retentionDays: 90,
    userSelectable: true,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_TEAM_FEATURES,
    billingInterval: ANNUAL,
    contractInterval: ANNUAL,
    onDemandEventPrice: 0.0377,
    allowOnDemand: true,
    reservedMinimum: 50000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
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
          events: 16_000_000,
          unitPrice: 0.013,
          price: 24738_00,
        },
        {
          events: 17_000_000,
          unitPrice: 0.013,
          price: 26142_00,
        },
        {
          events: 18_000_000,
          unitPrice: 0.013,
          price: 27546_00,
        },
        {
          events: 19_000_000,
          unitPrice: 0.013,
          price: 28950_00,
        },
        {
          events: 20_000_000,
          unitPrice: 0.013,
          price: 30354_00,
        },
        {
          events: 21_000_000,
          unitPrice: 0.012,
          price: 31650_00,
        },
        {
          events: 22_000_000,
          unitPrice: 0.012,
          price: 32946_00,
        },
        {
          events: 23_000_000,
          unitPrice: 0.012,
          price: 34242_00,
        },
        {
          events: 24_000_000,
          unitPrice: 0.012,
          price: 35538_00,
        },
        {
          events: 25_000_000,
          unitPrice: 0.012,
          price: 36834_00,
        },
        {
          events: 30_000_000,
          unitPrice: 0.012,
          price: 43314_00,
        },
        {
          events: 35_000_000,
          unitPrice: 0.012,
          price: 49794_00,
        },
        {
          events: 40_000_000,
          unitPrice: 0.012,
          price: 56274_00,
        },
        {
          events: 45_000_000,
          unitPrice: 0.012,
          price: 62754_00,
        },
        {
          events: 50_000_000,
          unitPrice: 0.012,
          price: 69234_00,
        },
      ],
      transactions: [
        {
          events: 100000,
          unitPrice: 0.0145,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0118,
          price: 16800,
        },
        {
          events: 500000,
          unitPrice: 0.0088,
          price: 32400,
        },
        {
          events: 1000000,
          unitPrice: 0.007,
          price: 60000,
        },
        {
          events: 1500000,
          unitPrice: 0.0064,
          price: 88800,
        },
        {
          events: 2000000,
          unitPrice: 0.0061,
          price: 116400,
        },
        {
          events: 2500000,
          unitPrice: 0.0059,
          price: 145200,
        },
        {
          events: 3000000,
          unitPrice: 0.0058,
          price: 172800,
        },
        {
          events: 3500000,
          unitPrice: 0.0057,
          price: 200400,
        },
        {
          events: 4000000,
          unitPrice: 0.0057,
          price: 229200,
        },
        {
          events: 4500000,
          unitPrice: 0.0056,
          price: 256800,
        },
        {
          events: 5000000,
          unitPrice: 0.0055,
          price: 282000,
        },
        {
          events: 5500000,
          unitPrice: 0.0054,
          price: 303600,
        },
        {
          events: 6000000,
          unitPrice: 0.0054,
          price: 325200,
        },
        {
          events: 6500000,
          unitPrice: 0.0054,
          price: 346800,
        },
        {
          events: 7000000,
          unitPrice: 0.0054,
          price: 368400,
        },
        {
          events: 7500000,
          unitPrice: 0.0054,
          price: 390000,
        },
        {
          events: 8000000,
          unitPrice: 0.0054,
          price: 411600,
        },
        {
          events: 8500000,
          unitPrice: 0.0054,
          price: 433200,
        },
        {
          events: 9000000,
          unitPrice: 0.0054,
          price: 454800,
        },
        {
          events: 9500000,
          unitPrice: 0.0054,
          price: 476400,
        },
        {
          events: 10000000,
          unitPrice: 0.0054,
          price: 498000,
        },
        {
          events: 15_000_000,
          unitPrice: 0.004,
          price: 6456_00,
        },
        {
          events: 20_000_000,
          unitPrice: 0.004,
          price: 7944_00,
        },
        {
          events: 25_000_000,
          unitPrice: 0.004,
          price: 9420_00,
        },
        {
          events: 30_000_000,
          unitPrice: 0.004,
          price: 10896_00,
        },
        {
          events: 35_000_000,
          unitPrice: 0.004,
          price: 12372_00,
        },
        {
          events: 40_000_000,
          unitPrice: 0.004,
          price: 13860_00,
        },
        {
          events: 45_000_000,
          unitPrice: 0.004,
          price: 15336_00,
        },
        {
          events: 50_000_000,
          unitPrice: 0.004,
          price: 16812_00,
        },
        {
          events: 55_000_000,
          unitPrice: 0.004,
          price: 18300_00,
        },
        {
          events: 60_000_000,
          unitPrice: 0.004,
          price: 19776_00,
        },
        {
          events: 65_000_000,
          unitPrice: 0.004,
          price: 21252_00,
        },
        {
          events: 70_000_000,
          unitPrice: 0.004,
          price: 22740_00,
        },
        {
          events: 75_000_000,
          unitPrice: 0.004,
          price: 24216_00,
        },
        {
          events: 80_000_000,
          unitPrice: 0.004,
          price: 25692_00,
        },
        {
          events: 85_000_000,
          unitPrice: 0.004,
          price: 27168_00,
        },
        {
          events: 90_000_000,
          unitPrice: 0.004,
          price: 28656_00,
        },
        {
          events: 95_000_000,
          unitPrice: 0.004,
          price: 30132_00,
        },
        {
          events: 100_000_000,
          unitPrice: 0.004,
          price: 31608_00,
        },
        {
          events: 125_000_000,
          unitPrice: 0.0027,
          price: 36780_00,
        },
        {
          events: 150_000_000,
          unitPrice: 0.0026,
          price: 41964_00,
        },
        {
          events: 175_000_000,
          unitPrice: 0.0025,
          price: 47136_00,
        },
        {
          events: 200_000_000,
          unitPrice: 0.0024,
          price: 52308_00,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_business_auf: {
    id: 'am2_business_auf',
    name: 'Business',
    description: '',
    price: 96000,
    basePrice: 96000,
    totalPrice: 96000,
    trialPlan: null,
    maxMembers: null,
    retentionDays: 90,
    userSelectable: true,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_BUSINESS_FEATURES,
    billingInterval: ANNUAL,
    contractInterval: ANNUAL,
    onDemandEventPrice: 0.1157,
    allowOnDemand: true,
    reservedMinimum: 50000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
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
          events: 16_000_000,
          unitPrice: 0.0251,
          price: 49632_00,
        },
        {
          events: 17_000_000,
          unitPrice: 0.0251,
          price: 52332_00,
        },
        {
          events: 18_000_000,
          unitPrice: 0.0251,
          price: 55032_00,
        },
        {
          events: 19_000_000,
          unitPrice: 0.0251,
          price: 57732_00,
        },
        {
          events: 20_000_000,
          unitPrice: 0.0251,
          price: 60432_00,
        },
        {
          events: 21_000_000,
          unitPrice: 0.0144,
          price: 61987_00,
        },
        {
          events: 22_000_000,
          unitPrice: 0.0144,
          price: 63542_00,
        },
        {
          events: 23_000_000,
          unitPrice: 0.0144,
          price: 65097_00,
        },
        {
          events: 24_000_000,
          unitPrice: 0.0144,
          price: 66652_00,
        },
        {
          events: 25_000_000,
          unitPrice: 0.0144,
          price: 68207_00,
        },
        {
          events: 30_000_000,
          unitPrice: 0.0144,
          price: 75983_00,
        },
        {
          events: 35_000_000,
          unitPrice: 0.0144,
          price: 83759_00,
        },
        {
          events: 40_000_000,
          unitPrice: 0.0144,
          price: 91535_00,
        },
        {
          events: 45_000_000,
          unitPrice: 0.0144,
          price: 99311_00,
        },
        {
          events: 50_000_000,
          unitPrice: 0.0144,
          price: 107087_00,
        },
      ],
      transactions: [
        {
          events: 100000,
          unitPrice: 0.0445,
          price: 0,
        },
        {
          events: 250000,
          unitPrice: 0.0358,
          price: 49200,
        },
        {
          events: 500000,
          unitPrice: 0.0268,
          price: 97200,
        },
        {
          events: 1000000,
          unitPrice: 0.0199,
          price: 168000,
        },
        {
          events: 1500000,
          unitPrice: 0.0176,
          price: 237600,
        },
        {
          events: 2000000,
          unitPrice: 0.0165,
          price: 308400,
        },
        {
          events: 2500000,
          unitPrice: 0.0158,
          price: 378000,
        },
        {
          events: 3000000,
          unitPrice: 0.0153,
          price: 448800,
        },
        {
          events: 3500000,
          unitPrice: 0.015,
          price: 518400,
        },
        {
          events: 4000000,
          unitPrice: 0.0147,
          price: 589200,
        },
        {
          events: 4500000,
          unitPrice: 0.0145,
          price: 658800,
        },
        {
          events: 5000000,
          unitPrice: 0.014,
          price: 708000,
        },
        {
          events: 5500000,
          unitPrice: 0.0134,
          price: 748800,
        },
        {
          events: 6000000,
          unitPrice: 0.0129,
          price: 788400,
        },
        {
          events: 6500000,
          unitPrice: 0.0125,
          price: 828000,
        },
        {
          events: 7000000,
          unitPrice: 0.0121,
          price: 868800,
        },
        {
          events: 7500000,
          unitPrice: 0.0118,
          price: 908400,
        },
        {
          events: 8000000,
          unitPrice: 0.0115,
          price: 948000,
        },
        {
          events: 8500000,
          unitPrice: 0.0113,
          price: 988800,
        },
        {
          events: 9000000,
          unitPrice: 0.011,
          price: 1028400,
        },
        {
          events: 9500000,
          unitPrice: 0.0109,
          price: 1068000,
        },
        {
          events: 10000000,
          unitPrice: 0.0107,
          price: 1107600,
        },
        {
          events: 15000000,
          unitPrice: 0.0085,
          price: 13260_00,
        },
        {
          events: 20000000,
          unitPrice: 0.0074,
          price: 15444_00,
        },
        {
          events: 25000000,
          unitPrice: 0.0067,
          price: 17628_00,
        },
        {
          events: 30000000,
          unitPrice: 0.0063,
          price: 19812_00,
        },
        {
          events: 35000000,
          unitPrice: 0.0059,
          price: 21984_00,
        },
        {
          events: 40000000,
          unitPrice: 0.0057,
          price: 24168_00,
        },
        {
          events: 45000000,
          unitPrice: 0.0055,
          price: 26352_00,
        },
        {
          events: 50000000,
          unitPrice: 0.0054,
          price: 28536_00,
        },
        {
          events: 55000000,
          unitPrice: 0.0053,
          price: 30720_00,
        },
        {
          events: 60000000,
          unitPrice: 0.0052,
          price: 32892_00,
        },
        {
          events: 65000000,
          unitPrice: 0.0051,
          price: 35076_00,
        },
        {
          events: 70000000,
          unitPrice: 0.005,
          price: 37260_00,
        },
        {
          events: 75000000,
          unitPrice: 0.0049,
          price: 39444_00,
        },
        {
          events: 80000000,
          unitPrice: 0.0049,
          price: 41628_00,
        },
        {
          events: 85000000,
          unitPrice: 0.0048,
          price: 43800_00,
        },
        {
          events: 90000000,
          unitPrice: 0.0048,
          price: 45984_00,
        },
        {
          events: 95000000,
          unitPrice: 0.0047,
          price: 48168_00,
        },
        {
          events: 100000000,
          unitPrice: 0.0047,
          price: 50352_00,
        },
        {
          events: 125_000_000,
          unitPrice: 0.0044,
          price: 59100_00,
        },
        {
          events: 150_000_000,
          unitPrice: 0.0042,
          price: 67848_00,
        },
        {
          events: 175_000_000,
          unitPrice: 0.0041,
          price: 76596_00,
        },
        {
          events: 200_000_000,
          unitPrice: 0.004,
          price: 85344_00,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_sponsored: {
    // NOTE: being deprecated
    id: 'am2_sponsored',
    name: 'Sponsored',
    description: '',
    price: 0,
    basePrice: 0,
    totalPrice: 0,
    trialPlan: null,
    maxMembers: null,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_TEAM_FEATURES,
    billingInterval: 'monthly',
    contractInterval: 'monthly',
    onDemandEventPrice: 0.0377,
    allowOnDemand: true,
    reservedMinimum: 5000000,
    allowAdditionalReservedEvents: false,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [{events: 5000000, unitPrice: 0.015, price: 0}],
      transactions: [{events: 10000000, unitPrice: 0.0054, price: 0}],
      replays: [{events: 10000, unitPrice: 0.288, price: 0}],
      attachments: [{events: 10, unitPrice: 25.0, price: 0}],
      monitorSeats: [{events: 500, unitPrice: 0, price: 0}],
      uptime: [{events: 500, unitPrice: 0, price: 0}],
      profileDuration: [{events: 0, unitPrice: 0, price: 0}],
    },
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
  },
  am2_sponsored_team_auf: {
    id: 'am2_sponsored_team_auf',
    name: 'Sponsored Team',
    description: '',
    price: 0,
    basePrice: 0,
    totalPrice: 0,
    trialPlan: null,
    maxMembers: null,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_TEAM_FEATURES,
    billingInterval: 'annual',
    contractInterval: 'annual',
    onDemandEventPrice: 0.0377,
    allowOnDemand: true,
    reservedMinimum: 50_000,
    allowAdditionalReservedEvents: false,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [{events: 50_000, unitPrice: 0.015, price: 0}],
      transactions: [{events: 100_000, unitPrice: 0.0054, price: 0}],
      replays: [{events: 500, unitPrice: 0.288, price: 0}],
      attachments: [{events: 1, unitPrice: 25.0, price: 0}],
      monitorSeats: [{events: 10, unitPrice: 0, price: 0}],
      uptime: [{events: 10, unitPrice: 0, price: 0}],
      profileDuration: [{events: 0, unitPrice: 0, price: 0}],
    },
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
  },
  am2_business_bundle: {
    id: 'am2_business_bundle',
    name: 'Business Bundle',
    description: '',
    price: 50000,
    basePrice: 50000,
    totalPrice: 50000,
    trialPlan: null,
    maxMembers: null,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.BUNDLE,
    features: AM2_BUSINESS_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0.1157,
    allowOnDemand: true,
    reservedMinimum: 500000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [
        {
          events: 500000,
          unitPrice: 0.03,
          price: 0,
        },
        {
          events: 1000000,
          unitPrice: 0.03,
          price: 15000,
        },
        {
          events: 1500000,
          unitPrice: 0.03,
          price: 30000,
        },
        {
          events: 2000000,
          unitPrice: 0.03,
          price: 45000,
        },
        {
          events: 3000000,
          unitPrice: 0.03,
          price: 75000,
        },
        {
          events: 4000000,
          unitPrice: 0.03,
          price: 105000,
        },
        {
          events: 5000000,
          unitPrice: 0.03,
          price: 135000,
        },
        {
          events: 6000000,
          unitPrice: 0.03,
          price: 165000,
        },
        {
          events: 7000000,
          unitPrice: 0.03,
          price: 195000,
        },
        {
          events: 8000000,
          unitPrice: 0.03,
          price: 225000,
        },
        {
          events: 9000000,
          unitPrice: 0.03,
          price: 255000,
        },
        {
          events: 10000000,
          unitPrice: 0.0251,
          price: 285000,
        },
        {
          events: 11000000,
          unitPrice: 0.0251,
          price: 310000,
        },
        {
          events: 12000000,
          unitPrice: 0.0251,
          price: 335000,
        },
        {
          events: 13000000,
          unitPrice: 0.0251,
          price: 360000,
        },
        {
          events: 14000000,
          unitPrice: 0.0251,
          price: 385000,
        },
        {
          events: 15000000,
          unitPrice: 0.0251,
          price: 410000,
        },
        {
          events: 16000000,
          unitPrice: 0.0251,
          price: 435000,
        },
        {
          events: 17000000,
          unitPrice: 0.0251,
          price: 460000,
        },
        {
          events: 18000000,
          unitPrice: 0.0251,
          price: 485000,
        },
        {
          events: 19000000,
          unitPrice: 0.0251,
          price: 510000,
        },
        {
          events: 20000000,
          unitPrice: 0.0251,
          price: 535000,
        },
        {
          events: 21000000,
          unitPrice: 0.0251,
          price: 549400,
        },
        {
          events: 22000000,
          unitPrice: 0.0251,
          price: 563800,
        },
        {
          events: 23000000,
          unitPrice: 0.0251,
          price: 578200,
        },
        {
          events: 24000000,
          unitPrice: 0.0251,
          price: 592600,
        },
        {
          events: 25000000,
          unitPrice: 0.0251,
          price: 607000,
        },
      ],
      transactions: [
        {
          events: 5000000,
          unitPrice: 0.014,
          price: 0,
        },
        {
          events: 5500000,
          unitPrice: 0.0134,
          price: 3700,
        },
        {
          events: 6000000,
          unitPrice: 0.0129,
          price: 7400,
        },
        {
          events: 6500000,
          unitPrice: 0.0125,
          price: 11100,
        },
        {
          events: 7000000,
          unitPrice: 0.0121,
          price: 14800,
        },
        {
          events: 7500000,
          unitPrice: 0.0118,
          price: 18500,
        },
        {
          events: 8000000,
          unitPrice: 0.0115,
          price: 22200,
        },
        {
          events: 8500000,
          unitPrice: 0.0113,
          price: 25900,
        },
        {
          events: 9000000,
          unitPrice: 0.011,
          price: 29600,
        },
        {
          events: 9500000,
          unitPrice: 0.0109,
          price: 33300,
        },
        {
          events: 10000000,
          unitPrice: 0.0107,
          price: 37000,
        },
        {
          events: 15000000,
          unitPrice: 0.009,
          price: 57200,
        },
        {
          events: 20000000,
          unitPrice: 0.0081,
          price: 77400,
        },
        {
          events: 25000000,
          unitPrice: 0.0076,
          price: 97600,
        },
        {
          events: 30000000,
          unitPrice: 0.0072,
          price: 117800,
        },
        {
          events: 35000000,
          unitPrice: 0.007,
          price: 138000,
        },
        {
          events: 40000000,
          unitPrice: 0.0068,
          price: 158200,
        },
        {
          events: 45000000,
          unitPrice: 0.0067,
          price: 178400,
        },
        {
          events: 50000000,
          unitPrice: 0.0066,
          price: 198600,
        },
        {
          events: 55000000,
          unitPrice: 0.0065,
          price: 218800,
        },
        {
          events: 60000000,
          unitPrice: 0.0064,
          price: 239000,
        },
        {
          events: 65000000,
          unitPrice: 0.0063,
          price: 259200,
        },
        {
          events: 70000000,
          unitPrice: 0.0063,
          price: 279400,
        },
        {
          events: 75000000,
          unitPrice: 0.0062,
          price: 299600,
        },
        {
          events: 80000000,
          unitPrice: 0.0062,
          price: 319800,
        },
        {
          events: 85000000,
          unitPrice: 0.0061,
          price: 340000,
        },
        {
          events: 90000000,
          unitPrice: 0.0061,
          price: 360200,
        },
        {
          events: 95000000,
          unitPrice: 0.0061,
          price: 380400,
        },
        {
          events: 100000000,
          unitPrice: 0.006,
          price: 400600,
        },
        {
          events: 125000000,
          unitPrice: 0.006,
          price: 481700,
        },
        {
          events: 150000000,
          unitPrice: 0.006,
          price: 562600,
        },
      ],
      replays: [
        {
          events: 25000,
          unitPrice: 0.2865,
          price: 0,
        },
        {
          events: 50000,
          unitPrice: 0.286,
          price: 7100,
        },
        {
          events: 75000,
          unitPrice: 0.2858,
          price: 14300,
        },
        {
          events: 100000,
          unitPrice: 0.2711,
          price: 21400,
        },
        {
          events: 200000,
          unitPrice: 0.2663,
          price: 47000,
        },
        {
          events: 300000,
          unitPrice: 0.2638,
          price: 72700,
        },
        {
          events: 400000,
          unitPrice: 0.2624,
          price: 98300,
        },
        {
          events: 500000,
          unitPrice: 0.2614,
          price: 124000,
        },
        {
          events: 600000,
          unitPrice: 0.2607,
          price: 149600,
        },
        {
          events: 700000,
          unitPrice: 0.2602,
          price: 175300,
        },
        {
          events: 800000,
          unitPrice: 0.2598,
          price: 200900,
        },
        {
          events: 900000,
          unitPrice: 0.2569,
          price: 226600,
        },
        {
          events: 1000000,
          unitPrice: 0.2482,
          price: 249700,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_business_249_bundle: {
    id: 'am2_business_249_bundle',
    name: 'Business Bundle',
    description: '',
    price: 24900,
    basePrice: 24900,
    totalPrice: 24900,
    trialPlan: null,
    maxMembers: null,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.BUNDLE,
    features: AM2_BUSINESS_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0.1157,
    allowOnDemand: true,
    reservedMinimum: 500000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [
        {
          events: 200000,
          unitPrice: 0.03,
          price: 0,
        },
        {
          events: 300000,
          unitPrice: 0.03,
          price: 5000,
        },
        {
          events: 400000,
          unitPrice: 0.03,
          price: 10000,
        },
        {
          events: 500000,
          unitPrice: 0.03,
          price: 15000,
        },
        {
          events: 1000000,
          unitPrice: 0.03,
          price: 30000,
        },
        {
          events: 1500000,
          unitPrice: 0.03,
          price: 45000,
        },
        {
          events: 2000000,
          unitPrice: 0.03,
          price: 60000,
        },
        {
          events: 3000000,
          unitPrice: 0.03,
          price: 90000,
        },
        {
          events: 4000000,
          unitPrice: 0.03,
          price: 120000,
        },
        {
          events: 5000000,
          unitPrice: 0.03,
          price: 150000,
        },
        {
          events: 6000000,
          unitPrice: 0.03,
          price: 180000,
        },
        {
          events: 7000000,
          unitPrice: 0.03,
          price: 210000,
        },
        {
          events: 8000000,
          unitPrice: 0.03,
          price: 240000,
        },
        {
          events: 9000000,
          unitPrice: 0.03,
          price: 270000,
        },
        {
          events: 10000000,
          unitPrice: 0.0251,
          price: 300000,
        },
        {
          events: 11000000,
          unitPrice: 0.0251,
          price: 325000,
        },
        {
          events: 12000000,
          unitPrice: 0.0251,
          price: 350000,
        },
        {
          events: 13000000,
          unitPrice: 0.0251,
          price: 375000,
        },
        {
          events: 14000000,
          unitPrice: 0.0251,
          price: 400000,
        },
        {
          events: 15000000,
          unitPrice: 0.0251,
          price: 425000,
        },
        {
          events: 16000000,
          unitPrice: 0.0251,
          price: 450000,
        },
        {
          events: 17000000,
          unitPrice: 0.0251,
          price: 475000,
        },
        {
          events: 18000000,
          unitPrice: 0.0251,
          price: 500000,
        },
        {
          events: 19000000,
          unitPrice: 0.0251,
          price: 525000,
        },
        {
          events: 20000000,
          unitPrice: 0.0251,
          price: 550000,
        },
        {
          events: 21000000,
          unitPrice: 0.0251,
          price: 564400,
        },
        {
          events: 22000000,
          unitPrice: 0.0251,
          price: 578800,
        },
        {
          events: 23000000,
          unitPrice: 0.0251,
          price: 593200,
        },
        {
          events: 24000000,
          unitPrice: 0.0251,
          price: 607600,
        },
        {
          events: 25000000,
          unitPrice: 0.0251,
          price: 622000,
        },
      ],
      transactions: [
        {
          events: 2000000,
          unitPrice: 0.014,
          price: 0,
        },
        {
          events: 2500000,
          unitPrice: 0.0134,
          price: 6500,
        },
        {
          events: 3000000,
          unitPrice: 0.014,
          price: 13000,
        },
        {
          events: 3500000,
          unitPrice: 0.0134,
          price: 19500,
        },
        {
          events: 4000000,
          unitPrice: 0.014,
          price: 26000,
        },
        {
          events: 4500000,
          unitPrice: 0.0134,
          price: 32500,
        },
        {
          events: 5000000,
          unitPrice: 0.014,
          price: 37100,
        },
        {
          events: 5500000,
          unitPrice: 0.0134,
          price: 40800,
        },
        {
          events: 6000000,
          unitPrice: 0.0129,
          price: 44500,
        },
        {
          events: 6500000,
          unitPrice: 0.0125,
          price: 48200,
        },
        {
          events: 7000000,
          unitPrice: 0.0121,
          price: 51900,
        },
        {
          events: 7500000,
          unitPrice: 0.0118,
          price: 55600,
        },
        {
          events: 8000000,
          unitPrice: 0.0115,
          price: 59300,
        },
        {
          events: 8500000,
          unitPrice: 0.0113,
          price: 63000,
        },
        {
          events: 9000000,
          unitPrice: 0.011,
          price: 66700,
        },
        {
          events: 9500000,
          unitPrice: 0.0109,
          price: 70400,
        },
        {
          events: 10000000,
          unitPrice: 0.0107,
          price: 74100,
        },
        {
          events: 15000000,
          unitPrice: 0.009,
          price: 94300,
        },
        {
          events: 20000000,
          unitPrice: 0.0081,
          price: 114500,
        },
        {
          events: 25000000,
          unitPrice: 0.0076,
          price: 134700,
        },
        {
          events: 30000000,
          unitPrice: 0.0072,
          price: 154900,
        },
        {
          events: 35000000,
          unitPrice: 0.007,
          price: 175100,
        },
        {
          events: 40000000,
          unitPrice: 0.0068,
          price: 195300,
        },
        {
          events: 45000000,
          unitPrice: 0.0067,
          price: 215500,
        },
        {
          events: 50000000,
          unitPrice: 0.0066,
          price: 235700,
        },
        {
          events: 55000000,
          unitPrice: 0.0065,
          price: 255900,
        },
        {
          events: 60000000,
          unitPrice: 0.0064,
          price: 276100,
        },
        {
          events: 65000000,
          unitPrice: 0.0063,
          price: 296300,
        },
        {
          events: 70000000,
          unitPrice: 0.0063,
          price: 316500,
        },
        {
          events: 75000000,
          unitPrice: 0.0062,
          price: 336700,
        },
        {
          events: 80000000,
          unitPrice: 0.0062,
          price: 356900,
        },
        {
          events: 85000000,
          unitPrice: 0.0061,
          price: 377100,
        },
        {
          events: 90000000,
          unitPrice: 0.0061,
          price: 397300,
        },
        {
          events: 95000000,
          unitPrice: 0.0061,
          price: 417400,
        },
        {
          events: 100000000,
          unitPrice: 0.006,
          price: 437700,
        },
        {
          events: 125000000,
          unitPrice: 0.006,
          price: 518800,
        },
        {
          events: 150000000,
          unitPrice: 0.006,
          price: 599700,
        },
      ],
      replays: [
        {
          events: 10000,
          unitPrice: 0.2865,
          price: 0,
        },
        {
          events: 25000,
          unitPrice: 0.2865,
          price: 4300,
        },
        {
          events: 50000,
          unitPrice: 0.286,
          price: 11400,
        },
        {
          events: 75000,
          unitPrice: 0.2858,
          price: 18600,
        },
        {
          events: 100000,
          unitPrice: 0.2711,
          price: 25700,
        },
        {
          events: 200000,
          unitPrice: 0.2663,
          price: 51300,
        },
        {
          events: 300000,
          unitPrice: 0.2638,
          price: 77000,
        },
        {
          events: 400000,
          unitPrice: 0.2624,
          price: 102600,
        },
        {
          events: 500000,
          unitPrice: 0.2614,
          price: 128300,
        },
        {
          events: 600000,
          unitPrice: 0.2607,
          price: 153900,
        },
        {
          events: 700000,
          unitPrice: 0.2602,
          price: 179600,
        },
        {
          events: 800000,
          unitPrice: 0.2598,
          price: 205200,
        },
        {
          events: 900000,
          unitPrice: 0.2569,
          price: 230900,
        },
        {
          events: 1000000,
          unitPrice: 0.2482,
          price: 254000,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_team_bundle: {
    id: 'am2_team_bundle',
    name: 'Team Bundle',
    description: '',
    price: 9900,
    basePrice: 9900,
    totalPrice: 9900,
    trialPlan: 'am2_business',
    maxMembers: null,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.BUNDLE,
    features: AM2_TEAM_FEATURES,
    billingInterval: MONTHLY,
    contractInterval: MONTHLY,
    onDemandEventPrice: 0.0377,
    allowOnDemand: true,
    reservedMinimum: 100000,
    allowAdditionalReservedEvents: false,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: true,
    planCategories: {
      errors: [
        {
          events: 100000,
          unitPrice: 0.0175,
          price: 0,
        },
        {
          events: 200000,
          unitPrice: 0.0175,
          price: 1700,
        },
        {
          events: 300000,
          unitPrice: 0.0175,
          price: 3500,
        },
        {
          events: 400000,
          unitPrice: 0.0175,
          price: 5200,
        },
        {
          events: 500000,
          unitPrice: 0.015,
          price: 7000,
        },
        {
          events: 1000000,
          unitPrice: 0.015,
          price: 14500,
        },
        {
          events: 1500000,
          unitPrice: 0.015,
          price: 22000,
        },
        {
          events: 2000000,
          unitPrice: 0.015,
          price: 29500,
        },
        {
          events: 3000000,
          unitPrice: 0.015,
          price: 44500,
        },
        {
          events: 4000000,
          unitPrice: 0.015,
          price: 59500,
        },
        {
          events: 5000000,
          unitPrice: 0.015,
          price: 74500,
        },
        {
          events: 6000000,
          unitPrice: 0.015,
          price: 89500,
        },
        {
          events: 7000000,
          unitPrice: 0.015,
          price: 104500,
        },
        {
          events: 8000000,
          unitPrice: 0.015,
          price: 119500,
        },
        {
          events: 9000000,
          unitPrice: 0.015,
          price: 134500,
        },
        {
          events: 10000000,
          unitPrice: 0.013,
          price: 149500,
        },
        {
          events: 11000000,
          unitPrice: 0.013,
          price: 162500,
        },
        {
          events: 12000000,
          unitPrice: 0.013,
          price: 175500,
        },
        {
          events: 13000000,
          unitPrice: 0.013,
          price: 188500,
        },
        {
          events: 14000000,
          unitPrice: 0.013,
          price: 201500,
        },
        {
          events: 15000000,
          unitPrice: 0.013,
          price: 214500,
        },
        {
          events: 16000000,
          unitPrice: 0.013,
          price: 227500,
        },
        {
          events: 17000000,
          unitPrice: 0.013,
          price: 240500,
        },
        {
          events: 18000000,
          unitPrice: 0.013,
          price: 253400,
        },
        {
          events: 19000000,
          unitPrice: 0.013,
          price: 266500,
        },
        {
          events: 20000000,
          unitPrice: 0.013,
          price: 279500,
        },
        {
          events: 21000000,
          unitPrice: 0.013,
          price: 291500,
        },
        {
          events: 22000000,
          unitPrice: 0.013,
          price: 303500,
        },
        {
          events: 23000000,
          unitPrice: 0.013,
          price: 315500,
        },
        {
          events: 24000000,
          unitPrice: 0.013,
          price: 327500,
        },
        {
          events: 25000000,
          unitPrice: 0.013,
          price: 339500,
        },
      ],
      transactions: [
        {
          events: 1000000,
          unitPrice: 0.007,
          price: 0,
        },
        {
          events: 1500000,
          unitPrice: 0.0064,
          price: 2600,
        },
        {
          events: 2000000,
          unitPrice: 0.0061,
          price: 5200,
        },
        {
          events: 2500000,
          unitPrice: 0.0059,
          price: 7800,
        },
        {
          events: 3000000,
          unitPrice: 0.0058,
          price: 10400,
        },
        {
          events: 3500000,
          unitPrice: 0.0057,
          price: 13000,
        },
        {
          events: 4000000,
          unitPrice: 0.0057,
          price: 15600,
        },
        {
          events: 4500000,
          unitPrice: 0.0056,
          price: 18200,
        },
        {
          events: 5000000,
          unitPrice: 0.0055,
          price: 20500,
        },
        {
          events: 5500000,
          unitPrice: 0.0054,
          price: 22500,
        },
        {
          events: 6000000,
          unitPrice: 0.0054,
          price: 24500,
        },
        {
          events: 6500000,
          unitPrice: 0.0054,
          price: 26500,
        },
        {
          events: 7000000,
          unitPrice: 0.0054,
          price: 28500,
        },
        {
          events: 7500000,
          unitPrice: 0.0054,
          price: 30500,
        },
        {
          events: 8000000,
          unitPrice: 0.0054,
          price: 32500,
        },
        {
          events: 8500000,
          unitPrice: 0.0054,
          price: 34500,
        },
        {
          events: 9000000,
          unitPrice: 0.0054,
          price: 36500,
        },
        {
          events: 9500000,
          unitPrice: 0.0054,
          price: 38500,
        },
        {
          events: 10000000,
          unitPrice: 0.0054,
          price: 40500,
        },
        {
          events: 15000000,
          unitPrice: 0.0044,
          price: 54200,
        },
        {
          events: 20000000,
          unitPrice: 0.0044,
          price: 67900,
        },
        {
          events: 25000000,
          unitPrice: 0.0044,
          price: 81600,
        },
        {
          events: 30000000,
          unitPrice: 0.0044,
          price: 95300,
        },
        {
          events: 35000000,
          unitPrice: 0.0044,
          price: 109000,
        },
        {
          events: 40000000,
          unitPrice: 0.0044,
          price: 122700,
        },
        {
          events: 45000000,
          unitPrice: 0.0044,
          price: 136400,
        },
        {
          events: 50000000,
          unitPrice: 0.0044,
          price: 150100,
        },
        {
          events: 55000000,
          unitPrice: 0.0044,
          price: 163800,
        },
        {
          events: 60000000,
          unitPrice: 0.0044,
          price: 177500,
        },
        {
          events: 65000000,
          unitPrice: 0.0044,
          price: 191200,
        },
        {
          events: 70000000,
          unitPrice: 0.0044,
          price: 204900,
        },
        {
          events: 75000000,
          unitPrice: 0.0044,
          price: 218600,
        },
        {
          events: 80000000,
          unitPrice: 0.0044,
          price: 232300,
        },
        {
          events: 85000000,
          unitPrice: 0.0044,
          price: 246000,
        },
        {
          events: 90000000,
          unitPrice: 0.0044,
          price: 259700,
        },
        {
          events: 95000000,
          unitPrice: 0.0044,
          price: 273400,
        },
        {
          events: 100000000,
          unitPrice: 0.0044,
          price: 273400,
        },
        {
          events: 125000000,
          unitPrice: 0.0044,
          price: 334900,
        },
        {
          events: 150000000,
          unitPrice: 0.0044,
          price: 382900,
        },
      ],
      replays: [
        {
          events: 10000,
          unitPrice: 0.288,
          price: 0,
        },
        {
          events: 25000,
          unitPrice: 0.2865,
          price: 4300,
        },
        {
          events: 50000,
          unitPrice: 0.286,
          price: 11400,
        },
        {
          events: 75000,
          unitPrice: 0.2858,
          price: 18600,
        },
        {
          events: 100000,
          unitPrice: 0.2711,
          price: 25700,
        },
        {
          events: 200000,
          unitPrice: 0.2663,
          price: 51300,
        },
        {
          events: 300000,
          unitPrice: 0.2638,
          price: 77000,
        },
        {
          events: 400000,
          unitPrice: 0.2624,
          price: 102600,
        },
        {
          events: 500000,
          unitPrice: 0.2614,
          price: 128300,
        },
        {
          events: 600000,
          unitPrice: 0.2607,
          price: 153900,
        },
        {
          events: 700000,
          unitPrice: 0.2602,
          price: 179600,
        },
        {
          events: 800000,
          unitPrice: 0.2598,
          price: 205200,
        },
        {
          events: 900000,
          unitPrice: 0.2569,
          price: 230900,
        },
        {
          events: 1000000,
          unitPrice: 0.2482,
          price: 254000,
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
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
  am2_business_ent_auf: {
    id: 'am2_business_ent_auf',
    name: 'Business',
    description: '',
    price: 0,
    basePrice: 0,
    totalPrice: 0,
    trialPlan: 'am2_business',
    maxMembers: null,
    retentionDays: 90,
    userSelectable: false,
    checkoutType: CheckoutType.STANDARD,
    features: AM2_BUSINESS_FEATURES,
    billingInterval: ANNUAL,
    contractInterval: ANNUAL,
    onDemandEventPrice: 0,
    allowOnDemand: true,
    reservedMinimum: 0,
    allowAdditionalReservedEvents: true,
    categoryDisplayNames: AM2_CATEGORY_DISPLAY_NAMES,
    categories: AM2_CATEGORIES,
    checkoutCategories: AM2_CATEGORIES,
    availableCategories: AM2_CATEGORIES,
    onDemandCategories: AM2_CATEGORIES,
    hasOnDemandModes: false,
    planCategories: {
      errors: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      transactions: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      replays: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      attachments: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      monitorSeats: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      uptime: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
      profileDuration: [
        {
          events: 0,
          unitPrice: 0,
          price: 0,
        },
      ],
    },
  },
};

export default AM2_PLANS;
