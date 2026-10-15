import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  getVisualizationTypeDisabledReason,
  WidgetBuilderTypeSelector as TypeSelector,
} from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('TypeSelector', () => {
  it('gates trace metrics tables behind the release flag', () => {
    const config = getDatasetConfig(WidgetType.TRACEMETRICS);

    expect(
      getVisualizationTypeDisabledReason(
        DisplayType.TABLE,
        config,
        WidgetType.TRACEMETRICS
      )
    ).toBe('Tables are not yet available for the Trace Metrics dataset.');
    expect(
      getVisualizationTypeDisabledReason(
        DisplayType.TABLE,
        config,
        WidgetType.TRACEMETRICS,
        true
      )
    ).toBeUndefined();
  });

  it('changes the visualization type', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>
    );

    // click dropdown
    await userEvent.click(await screen.findByText('Table'));
    // select new option
    await userEvent.click(await screen.findByText('Bar (Time Series)'));

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({displayType: 'bar'})
      );
    });
  });

  it('displays error message when there is an error', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector error={{displayType: 'Please select a type'}} />
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Please select a type')).toBeInTheDocument();
  });

  it('shows text widget option', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        organization: OrganizationFixture(),
      }
    );

    await userEvent.click(await screen.findByText('Table'));
    expect(screen.getByText('Text (Markdown)')).toBeInTheDocument();
  });

  it('resets the widget builder state when the display type is changed on an issue widget', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {displayType: 'line', dataset: WidgetType.ISSUE},
          },
        },
      }
    );

    await userEvent.click(await screen.findByText('Line'));
    await userEvent.click(await screen.findByText('Table'));

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({
          displayType: 'table',
          dataset: WidgetType.ISSUE,
          field: ['issue', 'assignee', 'title'],
        })
      );
    });
  });

  it('resets the widget builder state to dataset defaults when display type is changed from text widget', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {displayType: 'text'},
          },
        },
        organization: OrganizationFixture(),
      }
    );

    await userEvent.click(await screen.findByText('Text (Markdown)'));
    await userEvent.click(await screen.findByText('Table'));

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({
          displayType: 'table',
          dataset: WidgetType.ERRORS,
          field: 'count_unique(user)',
        })
      );
    });
  });
});
