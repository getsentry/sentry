import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('WidgetBuilder', () => {
  const initialRouterConfig = {
    route: '/organizations/:orgId/dashboard/:dashboardId/',
    location: {
      pathname: '/organizations/org-slug/dashboard/1/',
      query: {project: '-1'},
    },
  };

  it('edits name and description', async () => {
    const {router} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig,
      }
    );

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');

    // trigger blur
    await userEvent.tab();
    expect(router.location).toEqual(
      expect.objectContaining({
        ...initialRouterConfig.location,
        query: expect.objectContaining({title: 'some name'}),
      })
    );

    await userEvent.click(await screen.findByTestId('add-description'));

    await userEvent.type(
      await screen.findByPlaceholderText('Description'),
      'some description'
    );

    // trigger blur
    await userEvent.tab();
    expect(router.location).toEqual(
      expect.objectContaining({
        ...initialRouterConfig.location,
        query: expect.objectContaining({description: 'some description'}),
      })
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
        initialRouterConfig,
      }
    );

    expect(
      await screen.findByText('Title is required during creation.')
    ).toBeInTheDocument();
  });
});
