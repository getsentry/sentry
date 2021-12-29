import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueWidgetQueriesForm from 'sentry/components/dashboards/issueWidgetQueriesForm';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

describe('IssueWidgetQueriesForm', function () {
  const {organization, routerContext} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);
  const api = new MockApiClient();
  let onChangeHandler;
  let tagsMock;

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

    tagsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/event.type/values/',
      method: 'GET',
      body: [
        {
          key: 'event.type',
          name: 'default',
          value: 'default',
          count: 128467,
          lastSeen: '2021-12-10T16:37:00Z',
          firstSeen: '2021-12-09T16:37:02Z',
        },
        {
          key: 'event.type',
          name: 'error',
          value: 'error',
          count: 50257,
          lastSeen: '2021-12-10T16:36:51Z',
          firstSeen: '2021-12-09T16:37:07Z',
        },
      ],
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
      />,
      {context: routerContext}
    );
  });

  it('fetches tag values when when focused on a lhs tag condition', async function () {
    userEvent.type(screen.getAllByText('assigned:')[1], 'event.type:');
    await tick();
    expect(tagsMock).toHaveBeenCalled();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
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
