import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WidgetQueriesForm from 'sentry/components/dashboards/widgetQueriesForm';
import {DisplayType} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

describe('WidgetQueriesForm', function () {
  const {organization, routerContext} = initializeOrg({
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);
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

    const fieldOptions = {};

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
        queries={[
          {
            conditions: 'event.type:',
            fields: ['count()'],
            name: '',
            orderby: '',
          },
        ]}
        onChange={onChangeHandler}
        fieldOptions={fieldOptions as ReturnType<typeof generateFieldOptions>}
        canAddSearchConditions
        handleAddSearchConditions={() => undefined}
        handleDeleteQuery={() => undefined}
      />,
      {context: routerContext}
    );
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
});
