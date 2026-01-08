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
  it('shows dataset descriptions on hover', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>
    );

    // Open the CompactSelect menu
    await userEvent.click(await screen.findByText('Dataset'));

    // Hover over the Errors option and verify description appears
    const errorsOption = await screen.findByRole('option', {name: 'Errors'});
    await userEvent.hover(errorsOption);

    expect(
      await screen.findByText(
        'Error events from your application, including exception details and stack traces'
      )
    ).toBeInTheDocument();
  });

  it('changes the dataset', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>
    );

    // Open the CompactSelect menu
    await userEvent.click(await screen.findByText('Dataset'));

    // Find and click on the Issues option
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

    // Open the CompactSelect menu
    await userEvent.click(await screen.findByText('Dataset'));

    // Find the Transactions option and verify it's disabled
    const transactionsOption = await screen.findByText('Transactions');
    expect(transactionsOption.closest('[aria-disabled="true"]')).not.toBeNull();

    // Hover on the disabled transactions dataset to show tooltip
    await userEvent.hover(transactionsOption);

    expect(
      await screen.findByText(/This dataset is no longer supported./i)
    ).toBeInTheDocument();

    // Click on the "spans" link in the tooltip
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

    // Open the CompactSelect menu
    await userEvent.click(await screen.findByText('Dataset'));

    // Find the Transactions option and verify it's not disabled
    const transactionsOption = await screen.findByRole('option', {name: 'Transactions'});
    expect(transactionsOption.closest('[aria-disabled="true"]')).toBeNull();

    // Hover on the transactions option and verify description appears
    await userEvent.hover(transactionsOption);
    expect(
      await screen.findByText(
        'End-to-end application transactions showing performance and user experience metrics'
      )
    ).toBeInTheDocument();

    // Select transactions dataset
    await userEvent.click(transactionsOption);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'transaction-like'}),
      }),
      expect.anything()
    );
  });
});
