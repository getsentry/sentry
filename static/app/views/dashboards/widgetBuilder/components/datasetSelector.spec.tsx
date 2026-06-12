import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {replaceUrlWithoutNavigation} from 'sentry/utils/url/replaceUrlWithoutNavigation';
import {WidgetBuilderDatasetSelector as DatasetSelector} from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/url/replaceUrlWithoutNavigation');

const mockReplaceUrl = jest.mocked(replaceUrlWithoutNavigation);

describe('DatasetSelector', () => {
  it('changes the dataset', async () => {
    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));

    await userEvent.click(await screen.findByRole('option', {name: 'Issues'}));

    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'issue'}),
      })
    );
  });

  it('disables transactions dataset when discover-saved-queries-deprecation feature is enabled', async () => {
    const organizationWithDeprecation = OrganizationFixture({
      features: ['discover-saved-queries-deprecation'],
    });

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>,
      {
        organization: organizationWithDeprecation,
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));

    const transactionsOption = await screen.findByRole('option', {name: 'Transactions'});
    expect(transactionsOption).toHaveAttribute('aria-disabled', 'true');

    expect(
      await screen.findByText(/No longer supported\. Use the spans dataset with the/)
    ).toBeInTheDocument();
    expect(screen.getByText('is_transaction:true')).toBeInTheDocument();
  });

  it('allows selection of transactions dataset when discover-saved-queries-deprecation feature is disabled', async () => {
    const organizationWithoutDeprecation = OrganizationFixture({
      features: [], // No discover-saved-queries-deprecation feature
    });

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>,
      {
        organization: organizationWithoutDeprecation,
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));

    const transactionsOption = await screen.findByRole('option', {name: 'Transactions'});

    expect(
      await screen.findByText('Transactions from your application')
    ).toBeInTheDocument();

    await userEvent.click(transactionsOption);

    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'transaction-like'}),
      })
    );
  });
});
