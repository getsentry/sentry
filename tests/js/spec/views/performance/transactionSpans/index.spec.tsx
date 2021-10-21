import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
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
  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

describe('Performance > Transaction Spans', function () {
  beforeEach(function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events-spans-performance/',
      body: [
        makeSuspectSpan({
          op: 'op1',
          group: 'aaaaaaaa',
          examples: [
            {
              id: 'abababab',
              description: 'span-1',
              spans: [{id: 'ababab11'}, {id: 'ababab22'}],
            },
            {
              id: 'acacacac',
              description: 'span-2',
              spans: [{id: 'acacac11'}, {id: 'acacac22'}],
            },
          ],
        }),
        makeSuspectSpan({
          op: 'op2',
          group: 'bbbbbbbb',
          examples: [
            {
              id: 'bcbcbcbc',
              description: 'span-3',
              spans: [{id: 'bcbcbc11'}, {id: 'bcbcbc11'}],
            },
            {
              id: 'bdbdbdbd',
              description: 'span-4',
              spans: [{id: 'bdbdbd11'}, {id: 'bdbdbd22'}],
            },
          ],
        }),
      ],
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
      initialData.routerContext
    );

    // const cardUpper = await screen.findByTestId('suspect-card-upper');
    // console.log(cardUpper);
  });
});
