import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WidgetQueriesForm from 'sentry/components/dashboards/widgetQueriesForm';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

describe('WidgetQueriesForm', function () {
  const {organization} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  const queries: WidgetQuery[] = [
    {
      conditions: 'event.type:',
      fields: ['count()', 'release'],
      columns: ['release'],
      aggregates: ['count()'],
      name: '',
      orderby: '-count',
    },
  ];

  const onChangeHandler = jest.fn((_, newQuery) => {
    queries[0] = newQuery;
  });

  function TestComponent(props: Partial<WidgetQueriesForm['props']>) {
    return (
      <WidgetQueriesForm
        displayType={DisplayType.TABLE}
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
        queries={queries}
        onChange={onChangeHandler}
        fieldOptions={
          {
            'function:count': {
              label: 'count()',
              value: {
                kind: 'function',
                meta: {
                  name: 'count',
                  parameters: [],
                },
              },
            },
            'function:count_unique': {
              label: 'count_unique()',
              value: {
                kind: 'function',
                meta: {
                  name: 'count_unique',
                  parameters: [],
                },
              },
            },
          } as ReturnType<typeof generateFieldOptions>
        }
        canAddSearchConditions
        handleAddSearchConditions={jest.fn()}
        handleDeleteQuery={jest.fn()}
        widgetType={WidgetType.DISCOVER}
        {...props}
      />
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [
        {
          id: '5718466',
          organizationId: '1',
          type: 0,
          query: 'event.type:transaction',
          lastSeen: '2021-12-01T20:46:36.972966Z',
          dateCreated: '2021-12-01T20:46:36.975384Z',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
    });
  });

  it('only calls onChange once when selecting a value from the autocomplete dropdown', async function () {
    render(<TestComponent />);
    userEvent.click(screen.getByRole('textbox', {name: 'Search events'}));
    expect(await screen.findByText('Recent Searches')).toBeInTheDocument();
    userEvent.click(screen.getByText(':transaction'));
    expect(screen.getByText('event.type:transaction')).toBeInTheDocument();
    expect(onChangeHandler).toHaveBeenCalledTimes(1);
  });

  it('changes orderby to the new field', function () {
    const {rerender} = render(<TestComponent />);
    userEvent.click(screen.getByText('count()'));
    userEvent.click(screen.getByText('count_unique()'));
    rerender(<TestComponent />);
    expect(screen.getByText('count_unique() desc')).toBeInTheDocument();
  });

  it('does not show metrics tags in orderby', function () {
    const field = `sum(${SessionMetric.SESSION})`;
    render(
      <TestComponent
        widgetType={WidgetType.METRICS}
        queries={[
          {
            conditions: '',
            fields: [field, 'release'],
            columns: ['release'],
            aggregates: [field],
            name: '',
            orderby: field,
          },
        ]}
      />
    );
    userEvent.click(screen.getByText('sum(sentry.sessions.session) asc'));
    expect(screen.getByText('sum(sentry.sessions.session) desc')).toBeInTheDocument();
    expect(screen.queryByText('release asc')).not.toBeInTheDocument();
  });
});
