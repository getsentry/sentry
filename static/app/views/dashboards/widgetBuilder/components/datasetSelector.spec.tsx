import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import DatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('DatasetSelector', function () {
  let router!: ReturnType<typeof RouterFixture>;
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(function () {
    router = RouterFixture();
    organization = OrganizationFixture();
  });

  it('changes the dataset', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.click(await screen.findByLabelText('Issues'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({dataset: 'issue'}),
      }),
      expect.anything()
    );
  });

  it('disables transactions dataset when discover-saved-queries-deprecation feature is enabled', async function () {
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
        router,
        organization: organizationWithDeprecation,
        deprecatedRouterMocks: true,
      }
    );

    const transactionsRadio = screen.getByRole('radio', {name: /transactions/i});
    expect(transactionsRadio).toBeDisabled();

    // Hover on the disabled transactions dataset to show tooltip
    await userEvent.hover(transactionsRadio);

    expect(
      await screen.findByText(/This dataset is no longer supported./i)
    ).toBeInTheDocument();

    // Click on the "Spans" link in the tooltip
    const spansLink = screen.getByRole('link', {name: 'spans'});
    await userEvent.click(spansLink);

    // Verify navigation to spans dataset
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({dataset: 'spans'}),
      }),
      expect.anything()
    );
  });

  it('enables transactions dataset when discover-saved-queries-deprecation feature is disabled', async function () {
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
        router,
        organization: organizationWithoutDeprecation,
        deprecatedRouterMocks: true,
      }
    );

    const transactionsRadio = screen.getByRole('radio', {name: /transactions/i});
    expect(transactionsRadio).toBeEnabled();

    // Verify transactions dataset can be selected
    await userEvent.click(transactionsRadio);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({dataset: 'transaction-like'}),
      }),
      expect.anything()
    );
  });
});
