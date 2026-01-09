import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import DatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('DatasetSelector', () => {
  it('changes the dataset', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Errors'}));

    await userEvent.click(await screen.findByRole('option', {name: 'Issues'}));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'issue'}),
      }),
      expect.anything()
    );
  });

  it('disables transactions dataset when discover-saved-queries-deprecation feature is enabled', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

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
      await screen.findByText(/This dataset is no longer supported./i)
    ).toBeInTheDocument();

    const spansLink = screen.getByRole('link', {name: 'spans'});
    await userEvent.click(spansLink);

    // Verify navigation to spans dataset
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'spans'}),
      }),
      expect.anything()
    );
  });

  it('enables transactions dataset when discover-saved-queries-deprecation feature is disabled', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

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
    expect(transactionsOption).not.toHaveAttribute('aria-disabled', 'true');

    expect(
      await screen.findByText(
        'Transaction events that track the performance of operations in your application. Use for endpoint performance, throughput, and trends.'
      )
    ).toBeInTheDocument();

    await userEvent.click(transactionsOption);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'transaction-like'}),
      }),
      expect.anything()
    );
  });
});
