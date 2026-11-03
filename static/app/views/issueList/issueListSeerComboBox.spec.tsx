import {destroyAnnouncer} from '@react-aria/live-announcer';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IssueListSeerComboBox} from 'sentry/views/issueList/issueListSeerComboBox';

describe('IssueListSeerComboBox', () => {
  beforeEach(() => {
    destroyAnnouncer();
    MockApiClient.clearMockResponses();
  });

  it('replaces paging and time range params when a Seer query is applied', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/start/',
      method: 'POST',
      body: {run_id: 123},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/search-agent/state/123/',
      body: {
        session: {
          status: 'completed',
          current_step: null,
          completed_steps: [],
          final_response: {
            responses: [{query: 'is:unresolved', sort: 'freq', stats_period: '7d'}],
          },
        },
      },
    });
    const {organization} = initializeOrg({organization: {hideAiFeatures: false}});
    const onNuqsUrlUpdate = jest.fn();

    const {router} = render(
      <SearchQueryBuilderProvider
        enableAISearch
        filterKeys={{}}
        getTagValues={() => Promise.resolve([])}
        initialQuery=""
        searchSource="test"
      >
        <IssueListSeerComboBox />
      </SearchQueryBuilderProvider>,
      {
        organization,
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {
              cursor: '0:25:0',
              end: '2024-01-02T00:00:00',
              environment: 'prod',
              page: '1',
              pageStatsPeriod: '1h',
              project: '1',
              start: '2024-01-01T00:00:00',
              utc: 'true',
            },
          },
        },
      }
    );

    await userEvent.type(
      await screen.findByRole('combobox', {name: 'Ask Seer with Natural Language'}),
      'unresolved issues{Enter}'
    );
    await screen.findByRole('option', {name: /^Query parameters:/});
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(router.location.query).toEqual({
        environment: 'prod',
        project: '1',
        query: 'is:unresolved',
        referrer: 'issue-list',
        sort: 'freq',
        statsPeriod: '7d',
      })
    );
    expect(onNuqsUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'replace'})})
    );
  });
});
