import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {WidgetBuilderNameAndDescription} from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('WidgetBuilder', () => {
  it('edits name and description', async () => {
    setWindowLocation('http://localhost/organizations/org-slug/dashboard/1/?project=-1');

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription />
      </WidgetBuilderProvider>
    );

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');

    // trigger blur
    await userEvent.tab();
    // The widget builder writes its params to the URL without notifying the
    // router, so assert against the browser URL
    expect(window.location.search).toContain('title=some%20name');

    await userEvent.click(await screen.findByTestId('add-description'));

    await userEvent.type(
      await screen.findByPlaceholderText('Description'),
      'some description'
    );

    // trigger blur
    await userEvent.tab();
    expect(window.location.search).toContain('description=some%20description');
  });

  it('displays error', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription
          error={{title: 'Title is required during creation.'}}
        />
      </WidgetBuilderProvider>
    );

    expect(
      await screen.findByText('Title is required during creation.')
    ).toBeInTheDocument();
  });

  it('does not show the add description button for text widgets', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {displayType: 'text'},
          },
        },
      }
    );

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.queryByTestId('add-description')).not.toBeInTheDocument();
  });
});
