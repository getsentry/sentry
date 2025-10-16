import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('WidgetBuilder', () => {
  let router!: ReturnType<typeof RouterFixture>;
  let organization!: ReturnType<typeof OrganizationFixture>;
  beforeEach(() => {
    router = RouterFixture({
      location: {
        pathname: '/organizations/org-slug/dashboard/1/',
        query: {project: '-1'},
      },
      params: {},
    });
    organization = OrganizationFixture();
  });

  it('edits name and description', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription />
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');

    // trigger blur
    await userEvent.tab();
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({title: 'some name'}),
      }),
      expect.anything()
    );

    await userEvent.click(await screen.findByTestId('add-description'));

    await userEvent.type(
      await screen.findByPlaceholderText('Description'),
      'some description'
    );

    // trigger blur
    await userEvent.tab();
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({description: 'some description'}),
      }),
      expect.anything()
    );
  });

  it('displays error', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription
          error={{title: 'Title is required during creation.'}}
        />
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(
      await screen.findByText('Title is required during creation.')
    ).toBeInTheDocument();
  });
});
