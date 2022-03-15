import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueWidgetQueriesForm from 'sentry/components/dashboards/issueWidgetQueriesForm';
import {Organization} from 'sentry/types/organization';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

function renderComponent(
  organization?: Organization,
  routerContext?: ReturnType<typeof initializeOrg>['routerContext']
) {
  const onChangeHandler = jest.fn();
  const api = new MockApiClient();

  const testOrganization = organization || TestStubs.Organization();

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

  const tagsMock = MockApiClient.addMockResponse({
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

  const container = render(
    <IssueWidgetQueriesForm
      api={api}
      organization={testOrganization}
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
        columns: ['issue', 'assignee'],
        aggregates: ['issue', 'assignee'],
        name: '',
        orderby: 'date',
      }}
      onChange={onChangeHandler}
      fieldOptions={fieldOptions as ReturnType<typeof generateFieldOptions>}
    />,
    {context: routerContext}
  );

  return {container, organization: testOrganization, tagsMock, onChangeHandler};
}

describe('IssueWidgetQueriesForm', function () {
  const {organization, routerContext} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  it('fetches tag values when when focused on a lhs tag condition', async function () {
    const {tagsMock} = renderComponent(organization, routerContext);

    userEvent.type(screen.getAllByText('assigned:')[1], 'event.type:');
    await tick();
    expect(tagsMock).toHaveBeenCalled();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('only calls onChange once when selecting a value from the autocomplete dropdown', async function () {
    const {onChangeHandler} = renderComponent(organization, routerContext);

    userEvent.click(screen.getAllByText('assigned:')[1]);
    await tick();
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText(':#visibility level:error')).toBeInTheDocument();
    userEvent.click(screen.getByText(':#visibility level:error'));
    await tick();
    expect(onChangeHandler).toHaveBeenCalledTimes(1);
  });

  it('renders Widget Query Fields selector', function () {
    renderComponent(organization, routerContext);

    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByText('issue')).toBeInTheDocument();
    expect(screen.getByText('assignee')).toBeInTheDocument();
  });

  it('renders Widget Query Sort selector', function () {
    renderComponent(organization, routerContext);

    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
  });

  it('calls on change handler when changing sort', function () {
    const {onChangeHandler} = renderComponent(organization, routerContext);

    userEvent.click(screen.getByText('Last Seen'));
    userEvent.click(screen.getByText('First Seen'));
    expect(onChangeHandler).toHaveBeenCalledTimes(1);
    expect(onChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({orderby: 'new'})
    );
  });
});
