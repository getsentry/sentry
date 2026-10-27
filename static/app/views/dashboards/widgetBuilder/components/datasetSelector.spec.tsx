import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderDatasetSelector as DatasetSelector} from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('DatasetSelector', () => {
  it('changes the dataset', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));

    await userEvent.click(await screen.findByRole('option', {name: 'Issues'}));

    await waitFor(() => {
      expect(router.location.query).toEqual(expect.objectContaining({dataset: 'issue'}));
    });
  });

  it('does not restore a Trace Metrics table when the feature is disabled', async () => {
    const {router} = render(<DatasetSelector />, {
      organization: OrganizationFixture({features: ['tracemetrics-enabled']}),
      additionalWrapper: WidgetBuilderProvider,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboard/1/',
          query: {
            dataset: WidgetType.TRACEMETRICS,
            displayType: DisplayType.TABLE,
            field: ['sum(value,alpha_metric,counter,none)'],
          },
        },
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Application Metrics'})
    );
    await userEvent.click(await screen.findByRole('option', {name: 'Errors'}));

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));
    await userEvent.click(
      await screen.findByRole('option', {name: 'Application Metrics'})
    );

    await waitFor(() => {
      expect(router.location.query).toEqual(
        expect.objectContaining({displayType: DisplayType.LINE})
      );
    });
  });

  it('does not show the transactions dataset', async () => {
    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));
    expect(await screen.findByRole('option', {name: 'Issues'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Transactions'})).not.toBeInTheDocument();
  });
});
