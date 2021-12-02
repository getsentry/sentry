import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueWidgetQueriesForm from 'sentry/components/dashboards/issueWidgetQueriesForm';

describe('IssueWidgetQueriesForm', function () {
  const organization = TestStubs.Organization();
  let onChangeHandler;

  beforeEach(() => {
    onChangeHandler = jest.fn();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [
        {
          id: '5718466',
          organizationId: '1',
          type: 0,
          query: 'assigned:#visibility level:error',
          lastSeen: '2021-12-01T20:46:36.972966Z',
          dateCreated: '2021-12-01T20:46:36.975384Z',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
    });

    mountWithTheme(
      <IssueWidgetQueriesForm
        organization={organization}
        selection={{
          projects: [1],
          environments: ['prod'],
          datetime: {
            period: '14d',
            start: null,
            end: null,
            utc: false,
          },
        }}
        query={{
          conditions: 'assigned:',
          fields: [],
          name: '',
          orderby: '',
        }}
        onChange={onChangeHandler}
      />
    );
  });

  it('only calls onChange once when selecting a value from the autocomplete dropdown', async function () {
    userEvent.click(screen.getAllByText('assigned:')[1]);
    await tick();
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText(':#visibility level:error')).toBeInTheDocument();
    userEvent.click(screen.getByText(':#visibility level:error'));
    await tick();
    expect(onChangeHandler).toHaveBeenCalledTimes(1);
  });
});
