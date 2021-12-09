import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueWidgetQueriesForm from 'sentry/components/dashboards/issueWidgetQueriesForm';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

describe('IssueWidgetQueriesForm', function () {
  const organization = TestStubs.Organization();
  const api = new MockApiClient();
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

    const fieldOptions = {
      'field:issue': {
        label: 'issue',
        value: {
          kind: FieldValueKind.FIELD,
          meta: {
            name: 'issue',
            dataType: 'string',
          },
        },
      },
      'field:assignee': {
        label: 'assignee',
        value: {
          kind: FieldValueKind.FIELD,
          meta: {
            name: 'assignee',
            dataType: 'string',
          },
        },
      },
    };

    mountWithTheme(
      <IssueWidgetQueriesForm
        api={api}
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
          fields: ['issue', 'assignee'],
          name: '',
          orderby: '',
        }}
        onChange={onChangeHandler}
        fieldOptions={fieldOptions as ReturnType<typeof generateFieldOptions>}
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

  it('renders Widget Query Fields selector', async function () {
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByText('issue')).toBeInTheDocument();
    expect(screen.getByText('assignee')).toBeInTheDocument();
  });
});
