import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
import {getShortEventId} from 'app/utils/events';
import TransactionSpans from 'app/views/performance/transactionSummary/transactionSpans';

import {makeSuspectSpan} from './utils';

function initializeData({query} = {query: {}}) {
  const features = ['performance-view', 'performance-suspect-spans-view'];
  // @ts-expect-error
  const organization = TestStubs.Organization({
    features,
    // @ts-expect-error
    projects: [TestStubs.Project()],
  });
  // @ts-expect-error
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: 'Test Transaction',
          project: '1',
          ...query,
        },
      },
    },
  });
  act(() => void ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

const spans = [
  {
    op: 'op1',
    group: 'aaaaaaaaaaaaaaaa',
    examples: [
      {
        id: 'abababababababab',
        description: 'span-1',
        spans: [{id: 'ababab11'}, {id: 'ababab22'}],
      },
      {
        id: 'acacacacacacacac',
        description: 'span-2',
        spans: [{id: 'acacac11'}, {id: 'acacac22'}],
      },
    ],
  },
  {
    op: 'op2',
    group: 'bbbbbbbbbbbbbbbb',
    examples: [
      {
        id: 'bcbcbcbcbcbcbcbc',
        description: 'span-3',
        spans: [{id: 'bcbcbc11'}, {id: 'bcbcbc11'}],
      },
      {
        id: 'bdbdbdbdbdbdbdbd',
        description: 'span-4',
        spans: [{id: 'bdbdbd11'}, {id: 'bdbdbd22'}],
      },
    ],
  },
];

describe('Performance > Transaction Spans', function () {
  beforeEach(function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: spans.map(makeSuspectSpan),
    });
  });

  afterEach(function () {
    // @ts-expect-error
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    const initialData = initializeData();
    mountWithTheme(
      <TransactionSpans
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      {context: initialData.routerContext}
    );

    const cards = await screen.findAllByTestId('suspect-card');
    expect(cards).toHaveLength(2);
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      // these headers should be present by default
      expect(await within(card).findByText('Span Operation')).toBeTruthy();
      expect(await within(card).findByText('p75 Duration')).toBeTruthy();
      expect(await within(card).findByText('Frequency')).toBeTruthy();
      expect(await within(card).findByText('Total Cumulative Duration')).toBeTruthy();

      for (const example of spans[i].examples) {
        expect(await within(card).findByText(getShortEventId(example.id))).toBeTruthy();
      }
    }
  });
});
