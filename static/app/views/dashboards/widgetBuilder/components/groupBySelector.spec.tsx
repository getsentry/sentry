import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {TagStore} from 'sentry/stores/tagStore';
import {decodeList} from 'sentry/utils/queryString';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderGroupBySelector} from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

const organization = OrganizationFixture({
  features: [],
});
const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('WidgetBuilderGroupBySelector', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
  });

  it('renders', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Group')).toBeInTheDocument();
  });

  it('renders the group by field and works for spans', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Group')).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Select group'));
    await userEvent.click(await screen.findByText('timestamp'));

    await userEvent.click(await screen.findByText('+ Add Group'));
    await userEvent.click(await screen.findByText('Select group'));
    await userEvent.click(await screen.findByText('id'));

    expect(await screen.findAllByLabelText('Remove group')).toHaveLength(2);

    await userEvent.click((await screen.findAllByLabelText('Remove group'))[0]!);

    expect(await screen.findByText('id')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('timestamp')).not.toBeInTheDocument();
    });
  });

  it('renders the group by field and works for logs', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Group')).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Select group'));
    await userEvent.click(await screen.findByText('timestamp'));

    await userEvent.click(await screen.findByText('+ Add Group'));
    await userEvent.click(await screen.findByText('Select group'));
    await userEvent.click(await screen.findByText('message'));

    expect(await screen.findAllByLabelText('Remove group')).toHaveLength(2);

    await userEvent.click((await screen.findAllByLabelText('Remove group'))[0]!);

    expect(await screen.findByText('message')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('timestamp')).not.toBeInTheDocument();
    });
  });

  it('renders saved group bys on typed EAP attributes with prettified names', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {key: 'tags[my_number,number]', name: 'my_number', attributeType: 'number'},
        {key: 'tags[my_boolean,boolean]', name: 'my_boolean', attributeType: 'boolean'},
        {key: 'tags[my_string,string]', name: 'my_string', attributeType: 'string'},
      ],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization: OrganizationFixture({features: ['ourlogs-enabled']}),
        initialRouterConfig: {
          route: '/organizations/:orgId/dashboard/:dashboardId/',
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {
              dataset: WidgetType.LOGS,
              displayType: DisplayType.LINE,
              // Saved group bys keep the explicit `tags[name,type]` form.
              field: [
                'tags[my_number,number]',
                'tags[my_boolean,boolean]',
                'tags[my_string,string]',
              ],
            },
          },
        },
      }
    );

    expect(await screen.findByText('my_number')).toBeInTheDocument();
    expect(await screen.findByText('my_boolean')).toBeInTheDocument();
    expect(await screen.findByText('my_string')).toBeInTheDocument();
    expect(screen.queryByText('tags[my_number,number]')).not.toBeInTheDocument();
    expect(screen.queryByText('tags[my_boolean,boolean]')).not.toBeInTheDocument();
    expect(screen.queryByText('tags[my_string,string]')).not.toBeInTheDocument();
  });

  it('matches saved legacy tags[name] group bys to the tag option', async () => {
    TagStore.loadTagsSuccess([{key: 'my_tag', name: 'my_tag'}]);

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              dataset: WidgetType.ERRORS,
              displayType: DisplayType.LINE,
              field: ['tags[my_tag]'],
            },
          },
        },
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'my_tag'}));

    expect(await screen.findByRole('option', {name: /my_tag/})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.queryByRole('option', {name: /tags\[my_tag\]/})
    ).not.toBeInTheDocument();
  });

  it('badges typed EAP attributes with their real type', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {key: 'tags[is_equal,boolean]', name: 'is_equal', attributeType: 'boolean'},
        {key: 'tags[my_number,number]', name: 'my_number', attributeType: 'number'},
      ],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization: OrganizationFixture({features: ['ourlogs-enabled']}),
        initialRouterConfig: {
          route: '/organizations/:orgId/dashboard/:dashboardId/',
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {dataset: WidgetType.LOGS, displayType: DisplayType.LINE},
          },
        },
      }
    );

    await userEvent.click(await screen.findByText('Select group'));

    // The type badge sits alongside the label within the option row.
    const optionRow = (label: HTMLElement) => label.parentElement!.parentElement!;

    expect(optionRow(await screen.findByText('is_equal'))).toHaveTextContent('boolean');
    expect(optionRow(await screen.findByText('my_number'))).toHaveTextContent('number');
  });

  it('disables group by selector when transaction widget type and discover-saved-queries-deprecation feature flag', async () => {
    const organizationWithFeature = OrganizationFixture({
      features: ['discover-saved-queries-deprecation'],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          route: '/organizations/:orgId/dashboard/:dashboardId/',
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
        organization: organizationWithFeature,
      }
    );

    const addGroupButton = await screen.findByRole('button', {name: 'Add Group'});
    expect(addGroupButton).toBeDisabled();

    expect(await screen.findByRole('button', {name: 'Select group'})).toBeDisabled();
  });

  it('enables group by selector when transaction widget type but no discover-saved-queries-deprecation feature flag', async () => {
    const organizationWithoutFeature = OrganizationFixture({
      features: [],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          route: '/organizations/:orgId/dashboard/:dashboardId/',
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          },
        },
        organization: organizationWithoutFeature,
      }
    );

    const addGroupButton = await screen.findByRole('button', {name: 'Add Group'});
    expect(addGroupButton).toBeEnabled();

    expect(await screen.findByRole('button', {name: 'Select group'})).toBeEnabled();
  });

  it('enables group by selector when discover-saved-queries-deprecation feature flag but not transaction widget type', async () => {
    const organizationWithFeature = OrganizationFixture({
      features: ['discover-saved-queries-deprecation'],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          route: '/organizations/:orgId/dashboard/:dashboardId/',
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {
              dataset: WidgetType.ERRORS,
              displayType: DisplayType.LINE,
            },
          },
        },
        organization: organizationWithFeature,
      }
    );

    const addGroupButton = await screen.findByRole('button', {name: 'Add Group'});
    expect(addGroupButton).toBeEnabled();

    expect(await screen.findByRole('button', {name: 'Select group'})).toBeEnabled();
  });

  it('hides group by fields that are hidden in the trace metrics dataset', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {
          key: 'metric.name',
          name: 'metric.name',
        },
      ],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Group')).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Select group'));

    expect(screen.queryByText('metric.name')).not.toBeInTheDocument();
  });

  it('preserves aggregate fields when changing table groupings', async () => {
    const equation =
      'equation|sum(value,alpha_metric,counter,none) + avg(value,beta_metric,counter,none)';
    const {router} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderGroupBySelector preserveAggregateFields />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.TABLE,
              field: ['span.op', 'span.description', equation],
            },
          },
        },
      }
    );

    const removeButtons = await screen.findAllByRole('button', {
      name: 'Remove group',
    });
    await userEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(decodeList(router.location.query.field)).toEqual([
        'span.description',
        equation,
      ]);
    });
  });
});
