import type {
  AssertionFlow,
  AssertionsFlowExample,
} from 'sentry/views/replays/assertions/types';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

const AssertionDatabase = {
  flows: new Set<AssertionFlow>([
    {
      alerts_enabled: true,
      assigned_to: undefined,
      description: 'Test Flow',
      ending_actions: [],
      environment: 'production',
      project_id: '11276',
      id: '1',
      name: 'Test Flow',
      prev_id: undefined,
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: false,
      assigned_to: 'alice@example.com',
      description: 'Navigation to Checkout',
      ending_actions: [
        {
          matcher: {category: 'navigation'},
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '2',
      name: 'Checkout Navigation',
      prev_id: '1',
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: true,
      assigned_to: 'bob@example.com',
      description: 'User clicks and navigates',
      ending_actions: [
        {
          matcher: {category: 'navigation'},
          type: 'breadcrumb' as const,
        },
        {
          matcher: {op: 'navigation.navigate'},
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '3',
      name: 'Click and Navigate',
      prev_id: '2',
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'failure' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: false,
      assigned_to: undefined,
      description: 'Simple navigation span',
      ending_actions: [
        {
          matcher: {op: 'navigation.navigate'},
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '4',
      name: 'Navigation Span Only',
      prev_id: undefined,
      starting_action: {
        matcher: {category: 'navigation'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: true,
      assigned_to: 'carol@example.com',
      description: 'Multi-step checkout flow',
      ending_actions: [
        {
          matcher: {category: 'ui.click'},
          type: 'breadcrumb' as const,
        },
        {
          matcher: {op: 'navigation.navigate'},
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '5',
      name: 'Checkout Multi-Step',
      prev_id: '4',
      starting_action: {
        matcher: {category: 'navigation'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: false,
      assigned_to: 'dave@example.com',
      description: 'Failed navigation after click',
      ending_actions: [
        {
          matcher: {category: 'navigation'},
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '6',
      name: 'Failed Navigation',
      prev_id: '5',
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'failure' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: true,
      assigned_to: undefined,
      description: 'Breadcrumb only flow',
      ending_actions: [
        {
          matcher: {category: 'ui.click'},
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '7',
      name: 'Breadcrumb Only',
      prev_id: undefined,
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: false,
      assigned_to: 'eve@example.com',
      description: 'Navigation span with timeout',
      ending_actions: [
        {
          matcher: {op: 'navigation.navigate'},
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '8',
      name: 'Timeout Navigation',
      prev_id: '7',
      starting_action: {
        matcher: {category: 'navigation'},
        type: 'breadcrumb' as const,
      },
      status: 'failure' as const,
      timeout: 30_000, // 30 seconds
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: true,
      assigned_to: 'frank@example.com',
      description: 'Complex flow with multiple actions',
      ending_actions: [
        {
          matcher: {category: 'ui.click'},
          type: 'breadcrumb' as const,
        },
        {
          matcher: {category: 'navigation'},
          type: 'breadcrumb' as const,
        },
        {
          matcher: {op: 'navigation.navigate'},
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '9',
      name: 'Complex Multi-Action',
      prev_id: '8',
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
    {
      alerts_enabled: false,
      assigned_to: undefined,
      description: 'Minimal span flow',
      ending_actions: [
        {
          matcher: {category: 'ui.click'},
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '10',
      name: 'Minimal Span',
      prev_id: undefined,
      starting_action: {
        matcher: {category: 'ui.click'},
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
  ]),
  examples: new Set<AssertionsFlowExample>(),
};

export default AssertionDatabase;
