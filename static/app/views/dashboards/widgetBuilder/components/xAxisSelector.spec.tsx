import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderXAxisSelector} from 'sentry/views/dashboards/widgetBuilder/components/xAxisSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';
const DASHBOARD_WIDGET_BUILDER_ROUTE = '/organizations/:orgId/dashboards/new/widget/new/';

const ATTRIBUTES_URL = '/organizations/org-slug/trace-items/attributes/';

const organization = OrganizationFixture({
  features: ['performance-view', 'visibility-explore-view'],
});

const cappedAttribute = {
  key: 'span.description',
  name: 'span.description',
  attributeType: 'string',
  attributeSource: {source_type: 'sentry'},
};
const genAiAttribute = {
  key: 'gen_ai.tool.name',
  name: 'gen_ai.tool.name',
  attributeType: 'string',
  attributeSource: {source_type: 'sentry'},
};

describe('WidgetBuilderXAxisSelector', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: ATTRIBUTES_URL,
      method: 'GET',
      body: [cappedAttribute],
    });
  });

  function renderSelector() {
    return render(<WidgetBuilderXAxisSelector />, {
      organization,
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
          query: {
            dataset: WidgetType.SPANS,
            displayType: DisplayType.CATEGORICAL_BAR,
          },
        },
        route: DASHBOARD_WIDGET_BUILDER_ROUTE,
      },
    });
  }

  it('fetches attributes from the server while typing', async () => {
    const searchAttributesMock = MockApiClient.addMockResponse({
      url: ATTRIBUTES_URL,
      method: 'GET',
      body: [cappedAttribute, genAiAttribute],
      match: [MockApiClient.matchQuery({substringMatch: 'gen_ai'})],
    });

    renderSelector();

    expect(await screen.findByText('X-Axis')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'None'}));

    // The attribute is not part of the initial (capped) response.
    expect(
      await screen.findByRole('option', {name: /span\.description/})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: /gen_ai\.tool\.name/})
    ).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'gen_ai');

    await waitFor(() =>
      expect(searchAttributesMock).toHaveBeenCalledWith(
        ATTRIBUTES_URL,
        expect.objectContaining({
          query: expect.objectContaining({substringMatch: 'gen_ai'}),
        })
      )
    );
    expect(
      await screen.findByRole('option', {name: /gen_ai\.tool\.name/})
    ).toBeInTheDocument();
  });
});
