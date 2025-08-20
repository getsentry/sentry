import Storage from 'sentry/utils/localStorage';
import type {
  AssertionFlow,
  AssertionsFlowExample,
} from 'sentry/utils/replays/assertions/types';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

const AssertionDatabase = {
  persist: () => {
    Storage.setItem(
      'assertions',
      JSON.stringify({
        flows: Array.from(AssertionDatabase.flows),
        examples: Array.from(AssertionDatabase.examples),
      })
    );
  },
  restore: () => {
    const data = JSON.parse(Storage.getItem('assertions') ?? '{}');
    AssertionDatabase.flows = new Set(data.flows ?? []);
    AssertionDatabase.examples = new Set(data.examples ?? []);
  },
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
      original_id: '1',
      prev_id: undefined,
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'button',
            fullSelector:
              'button.app-16cczkt.ebcy13q0[role="button"][aria-label="*****"][data-test-id=""][alt=""][title=""][data-sentry-component="OriginalReplayPlayPauseButton"]',
            parts: {
              alt: '',
              ariaLabel: '*****',
              classes: ['app-16cczkt', 'ebcy13q0'],
              componentName: 'OriginalReplayPlayPauseButton',
              id: '',
              role: 'button',
              tag: 'button',
              testId: '',
              title: '',
            },
          },
        },
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
          category: 'navigation',
          matcher: {url: '/issues/'},
          type: 'breadcrumb',
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '2',
      name: 'Checkout Navigation',
      original_id: '1',
      prev_id: '1',
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'a',
            fullSelector:
              'a.ehp4qnd0.app-bxjpl0.e1mlkd1510[role=""][aria-label=""][data-test-id=""][alt=""][title=""][data-sentry-component="ChonkSwitch"]',
            parts: {
              alt: '',
              ariaLabel: '',
              classes: ['ehp4qnd0', 'app-bxjpl0', 'e1mlkd1510'],
              componentName: 'ChonkSwitch',
              id: '',
              role: '',
              tag: 'a',
              testId: '',
              title: '',
            },
          },
        },
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
          category: 'navigation',
          matcher: {url: '/issues/'},
          type: 'breadcrumb' as const,
        },
        {
          op: 'navigation.navigate',
          matcher: undefined,
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '3',
      name: 'Click and Navigate',
      original_id: '1',
      prev_id: '2',
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'a',
            fullSelector:
              'a[role=""][aria-label=""][data-test-id=""][alt=""][title=""][data-sentry-component=""]',
            parts: {
              alt: '',
              ariaLabel: '',
              classes: [],
              componentName: '',
              id: '',
              role: '',
              tag: 'a',
              testId: '',
              title: '',
            },
          },
        },
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
          op: 'navigation.navigate',
          matcher: undefined,
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '4',
      name: 'Navigation Span Only',
      original_id: '4',
      prev_id: undefined,
      starting_action: {
        category: 'navigation',
        matcher: {url: '/issues/'},
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
          category: 'ui.click',
          matcher: {
            dom_element: {
              selector: 'button',
              fullSelector:
                'button#react-aria7014089757-«re3».e5kqozx1.app-1f44tel.e1b3f8b00[role="button"][aria-label=""][data-test-id=""][alt=""][title=""][data-sentry-component="DropdownButton"]',
              parts: {
                alt: '',
                ariaLabel: '',
                classes: ['e5kqozx1', 'app-1f44tel', 'e1b3f8b00'],
                componentName: 'DropdownButton',
                id: 'react-aria7014089757-«re3»',
                role: 'button',
                tag: 'button',
                testId: '',
                title: '',
              },
            },
          },
          type: 'breadcrumb' as const,
        },
        {
          op: 'navigation.navigate',
          matcher: undefined,
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '5',
      name: 'Checkout Multi-Step',
      original_id: '4',
      prev_id: '4',
      starting_action: {
        category: 'navigation',
        matcher: {url: '/issues/'},
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
          category: 'navigation',
          matcher: {url: '/issues/'},
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '6',
      name: 'Failed Navigation',
      original_id: '4',
      prev_id: '5',
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'button',
            fullSelector:
              'button.app-1y2uh9v.ebcy13q0[role="button"][aria-label="*****"][data-test-id=""][alt=""][title=""][data-sentry-component="StyledButton"]',
            parts: {
              alt: '',
              ariaLabel: '*****',
              classes: ['app-1y2uh9v', 'ebcy13q0'],
              componentName: 'StyledButton',
              id: '',
              role: 'button',
              tag: 'button',
              testId: '',
              title: '',
            },
          },
        },
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
          category: 'ui.click',
          matcher: {
            dom_element: {
              selector: 'button',
              fullSelector:
                'button.app-1y2uh9v.e25erw0[role="button"][aria-label="*****"][data-test-id=""][alt=""][title=""][data-sentry-component="StyledButton"]',
              parts: {
                alt: '',
                ariaLabel: '*****',
                classes: ['app-1y2uh9v', 'e25erw0'],
                componentName: 'StyledButton',
                id: '',
                role: 'button',
                tag: 'button',
                testId: '',
                title: '',
              },
            },
          },
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '7',
      name: 'Breadcrumb Only',
      original_id: '7',
      prev_id: undefined,
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'button',
            fullSelector:
              'button.eho57gj2.app-2ut21w.e10fceod0[role="button"][aria-label="**** *** ***********"][data-test-id=""][alt=""][title=""][data-sentry-component="StyledButton"]',
            parts: {
              alt: '',
              ariaLabel: '**** *** ***********',
              classes: ['eho57gj2', 'app-2ut21w', 'e10fceod0'],
              componentName: 'StyledButton',
              id: '',
              role: 'button',
              tag: 'button',
              testId: '',
              title: '',
            },
          },
        },
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
          op: 'navigation.navigate',
          matcher: undefined,
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '8',
      name: 'Timeout Navigation',
      original_id: '7',
      prev_id: '7',
      starting_action: {
        category: 'navigation',
        matcher: {url: '/issues/'},
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
          category: 'ui.click',
          matcher: {
            dom_element: {
              selector: 'a',
              fullSelector:
                'a#sidebar-item-issues.app-wgrub8.e88zkai7[role=""][aria-label=""][data-test-id=""][alt=""][title=""][data-sentry-component=""]',
              parts: {
                alt: '',
                ariaLabel: '',
                classes: ['app-wgrub8', 'e88zkai7'],
                componentName: '',
                id: 'sidebar-item-issues',
                role: '',
                tag: 'a',
                testId: '',
                title: '',
              },
            },
          },
          type: 'breadcrumb' as const,
        },
        {
          category: 'navigation',
          matcher: {url: '/issues/'},
          type: 'breadcrumb' as const,
        },
        {
          op: 'navigation.navigate',
          matcher: undefined,
          type: 'span' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '9',
      name: 'Complex Multi-Action',
      original_id: '7',
      prev_id: '8',
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'button',
            fullSelector:
              'button.e7xxjx11.app-1syrwuh.e25erw0[role="button"][aria-label=""][data-test-id="page-filter-timerange-selector"][alt=""][title=""][data-sentry-component="DropdownButton"]',
            parts: {
              alt: '',
              ariaLabel: '',
              classes: ['e7xxjx11', 'app-1syrwuh', 'e25erw0'],
              componentName: 'DropdownButton',
              id: '',
              role: 'button',
              tag: 'button',
              testId: 'page-filter-timerange-selector',
              title: '',
            },
          },
        },
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
          category: 'ui.click',
          matcher: {
            dom_element: {
              selector: 'a',
              fullSelector:
                'a.ehp4qnd0.app-zpx1n1.e1btlgcw5[role=""][aria-label=""][data-test-id=""][alt=""][title=""][data-sentry-component="ChonkSwitch"]',
              parts: {
                alt: '',
                ariaLabel: '',
                classes: ['ehp4qnd0', 'app-zpx1n1', 'e1btlgcw5'],
                componentName: 'ChonkSwitch',
                id: '',
                role: '',
                tag: 'a',
                testId: '',
                title: '',
              },
            },
          },
          type: 'breadcrumb' as const,
        },
      ],
      environment: 'production',
      project_id: '11276',
      id: '10',
      name: 'Minimal Span',
      original_id: '10',
      prev_id: undefined,
      starting_action: {
        category: 'ui.click',
        matcher: {
          dom_element: {
            selector: 'a',
            fullSelector:
              'a.ek0ezcd0.app-1fsd4qb.e1vfefc60[role="button"][aria-label="******** *****"][data-test-id=""][alt=""][title=""][data-sentry-component="RouterLink"]',
            parts: {
              alt: '',
              ariaLabel: '******** *****',
              classes: ['ek0ezcd0', 'app-1fsd4qb', 'e1vfefc60'],
              componentName: 'RouterLink',
              id: '',
              role: 'button',
              tag: 'a',
              testId: '',
              title: '',
            },
          },
        },
        type: 'breadcrumb' as const,
      },
      status: 'success' as const,
      timeout: DEFAULT_TIMEOUT_MS,
      created_at: '2021-01-01T00:00:00Z',
    },
  ]),
  examples: new Set<AssertionsFlowExample>(),
};

AssertionDatabase.restore();

export default AssertionDatabase;
