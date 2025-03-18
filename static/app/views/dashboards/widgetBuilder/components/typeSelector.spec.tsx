import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import TypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

vi.mock('sentry/utils/useNavigate', () => ({
  useNavigate: vi.fn(),
}));

const mockUseNavigate = vi.mocked(useNavigate);

describe('TypeSelector', () => {
  let router!: ReturnType<typeof RouterFixture>;
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(function () {
    router = RouterFixture();
    organization = OrganizationFixture({});
  });

  it('changes the visualization type', async function () {
    const mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        router,
        organization,
      }
    );

    // click dropdown
    await userEvent.click(await screen.findByText('Table'));
    // select new option
    await userEvent.click(await screen.findByText('Bar'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({displayType: 'bar'}),
      }),
      {replace: true}
    );
  });

  it('displays error message when there is an error', async function () {
    render(
      <WidgetBuilderProvider>
        <TypeSelector error={{displayType: 'Please select a type'}} />
      </WidgetBuilderProvider>,
      {router, organization}
    );

    expect(await screen.findByText('Please select a type')).toBeInTheDocument();
  });
});
