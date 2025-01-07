import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import TypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);
const mockSetError = jest.fn();

describe('TypeSelector', () => {
  let router!: ReturnType<typeof RouterFixture>;
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(function () {
    router = RouterFixture();
    organization = OrganizationFixture({});
  });

  it('changes the visualization type', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <TypeSelector error={{}} setError={mockSetError} />
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
      })
    );
  });

  it('displays error message when there is an error', async function () {
    render(
      <WidgetBuilderProvider>
        <TypeSelector
          error={{displayType: 'Please select a type'}}
          setError={mockSetError}
        />
      </WidgetBuilderProvider>,
      {router, organization}
    );

    expect(await screen.findByText('Please select a type')).toBeInTheDocument();
  });
});
