import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('renders the group by field and can function', async function () {
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
});
