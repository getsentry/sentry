import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import DatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

vi.mock('sentry/utils/useNavigate', () => ({
  useNavigate: vi.fn(),
}));

const mockUseNavigate = vi.mocked(useNavigate);

describe('DatasetSelector', function () {
  let router!: ReturnType<typeof RouterFixture>;
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(function () {
    router = RouterFixture();
    organization = OrganizationFixture({});
  });

  it('changes the dataset', async function () {
    const mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <DatasetSelector />
      </WidgetBuilderProvider>,
      {
        router,
        organization,
      }
    );

    await userEvent.click(await screen.findByLabelText('Issues'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({dataset: 'issue'}),
      }),
      {replace: true}
    );
  });
});
