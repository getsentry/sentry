import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WidgetQueriesForm from 'sentry/components/dashboards/widgetQueriesForm';
import {DisplayType} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

describe('WidgetQueriesForm', function () {
  const {organization} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);
  let onChangeHandler;
  let queries;

  const mountComponent = () =>
    mountWithTheme(
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
        handleAddSearchConditions={() => undefined}
        handleDeleteQuery={() => undefined}
      />
    );
  beforeEach(() => {
    onChangeHandler = jest.fn((_, newQuery) => {
      queries[0] = newQuery;
    });
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
    queries = [
      {
        conditions: 'event.type:',
        fields: ['count()'],
        name: '',
        orderby: '-count',
      },
    ];
    mountComponent();
  });

  it('only calls onChange once when selecting a value from the autocomplete dropdown', async function () {
    userEvent.click(screen.getAllByText('event.type:')[1]);
    await tick();
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText(':transaction')).toBeInTheDocument();
    userEvent.click(screen.getByText(':transaction'));
    await tick();
    expect(onChangeHandler).toHaveBeenCalledTimes(1);
  });

  it('changes orderby to the new field', async function () {
    userEvent.click(screen.getByText('count()'));
    userEvent.click(screen.getByText('count_unique()'));
    mountComponent();
    expect(screen.getByText('count_unique() desc')).toBeInTheDocument();
  });
});
