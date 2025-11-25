import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('WidgetBuilder', () => {
  it('edits name and description', async () => {
    setWindowLocation('http://localhost/organizations/org-slug/dashboard/1/?project=-1');

    const {router} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderNameAndDescription />
      </WidgetBuilderProvider>
    );

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');

    // trigger blur
    await userEvent.tab();
    expect(router.location).toEqual(
      expect.objectContaining({
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
      </WidgetBuilderProvider>
    );

    expect(
      await screen.findByText('Title is required during creation.')
    ).toBeInTheDocument();
  });
});
