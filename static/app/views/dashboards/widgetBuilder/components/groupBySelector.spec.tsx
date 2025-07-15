import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetBuilderGroupBySelector from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

const organization = OrganizationFixture({
  features: [],
});

describe('WidgetBuilderGroupBySelector', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
  });

  it('renders', async function () {
    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderGroupBySelector validatedWidgetResponse={{} as any} />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        organization,
      }
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Group')).toBeInTheDocument();
  });

  it('renders the group by field and works for spans', async function () {
    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderGroupBySelector validatedWidgetResponse={{} as any} />
        </TraceItemAttributeProvider>
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

  it('renders the group by field and works for logs', async function () {
    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <WidgetBuilderGroupBySelector validatedWidgetResponse={{} as any} />
        </TraceItemAttributeProvider>
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

  it('disables group by selector when transaction widget type and discover-saved-queries-deprecation feature flag', async function () {
    const organizationWithFeature = OrganizationFixture({
      features: ['discover-saved-queries-deprecation'],
    });

    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderGroupBySelector validatedWidgetResponse={{} as any} />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        organization: organizationWithFeature,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
        deprecatedRouterMocks: true,
      }
    );

    const addGroupButton = await screen.findByRole('button', {name: 'Add Group'});
    expect(addGroupButton).toBeDisabled();

    // The QueryField component renders a Select component with a disabled input
    const selectInput = await screen.findByRole('textbox');
    expect(selectInput).toBeDisabled();
  });

  it('enables group by selector when transaction widget type but no discover-saved-queries-deprecation feature flag', async function () {
    const organizationWithoutFeature = OrganizationFixture({
      features: [],
    });

    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderGroupBySelector validatedWidgetResponse={{} as any} />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        organization: organizationWithoutFeature,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
        deprecatedRouterMocks: true,
      }
    );

    const addGroupButton = await screen.findByRole('button', {name: 'Add Group'});
    expect(addGroupButton).toBeEnabled();

    const selectInput = await screen.findByRole('textbox');
    expect(selectInput).toBeEnabled();
  });

  it('enables group by selector when discover-saved-queries-deprecation feature flag but not transaction widget type', async function () {
    const organizationWithFeature = OrganizationFixture({
      features: ['discover-saved-queries-deprecation'],
    });

    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderGroupBySelector validatedWidgetResponse={{} as any} />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        organization: organizationWithFeature,
        router: RouterFixture({
          location: LocationFixture({
            query: {
              dataset: WidgetType.ERRORS,
              displayType: DisplayType.LINE,
            },
          }),
        }),
        deprecatedRouterMocks: true,
      }
    );

    const addGroupButton = await screen.findByRole('button', {name: 'Add Group'});
    expect(addGroupButton).toBeEnabled();

    const selectInput = await screen.findByRole('textbox');
    expect(selectInput).toBeEnabled();
  });
});
