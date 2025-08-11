import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventIdField from 'sentry/views/settings/components/dataScrubbing/modals/form/eventIdField';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';

const eventIdValue = '887ab369df634e74aea708bcafe1a175';

describe('EventIdField', function () {
  it('default render', async function () {
    const handleUpdateEventId = jest.fn();

    render(
      <EventIdField
        onUpdateEventId={handleUpdateEventId}
        eventId={{value: '', status: EventIdStatus.UNDEFINED}}
      />
    );

    expect(screen.getByText('Event ID (Optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('XXXXXXXXXXXXXX')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');

    await userEvent.hover(screen.getByTestId('more-information'));

    expect(
      await screen.findByText(
        'Providing an event ID will automatically provide you a list of suggested sources'
      )
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole('textbox'),
      '887ab369df634e74aea708bcafe1a175{enter}'
    );

    expect(handleUpdateEventId).toHaveBeenCalled();
  });

  it('LOADING status', function () {
    render(
      <EventIdField
        onUpdateEventId={jest.fn()}
        eventId={{value: eventIdValue, status: EventIdStatus.LOADING}}
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue(eventIdValue);

    expect(screen.getByTestId('saving')).toBeInTheDocument();
  });

  it('LOADED status', function () {
    render(
      <EventIdField
        onUpdateEventId={jest.fn()}
        eventId={{value: eventIdValue, status: EventIdStatus.LOADED}}
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue(eventIdValue);

    expect(screen.queryByLabelText('Clear event ID')).not.toBeInTheDocument();

    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('ERROR status', async function () {
    render(
      <EventIdField
        onUpdateEventId={jest.fn()}
        eventId={{value: eventIdValue, status: EventIdStatus.ERROR}}
      />
    );

    await userEvent.hover(screen.getByTestId('icon-close'));

    expect(await screen.findByText('Clear event ID')).toBeInTheDocument();

    expect(screen.getByRole('textbox')).toHaveValue(eventIdValue);

    expect(
      screen.getByText(
        'An error occurred while fetching the suggestions based on this event ID'
      )
    ).toBeInTheDocument();
  });

  it('INVALID status', async function () {
    render(
      <EventIdField
        onUpdateEventId={jest.fn()}
        eventId={{value: eventIdValue, status: EventIdStatus.INVALID}}
      />
    );

    expect(await screen.findByRole('textbox')).toHaveValue(eventIdValue);

    expect(screen.getByText('This event ID is invalid')).toBeInTheDocument();
  });

  it('NOTFOUND status', async function () {
    render(
      <EventIdField
        onUpdateEventId={jest.fn()}
        eventId={{value: eventIdValue, status: EventIdStatus.NOT_FOUND}}
      />
    );

    expect(await screen.findByRole('textbox')).toHaveValue(eventIdValue);

    expect(
      screen.getByText('The chosen event ID was not found in projects you have access to')
    ).toBeInTheDocument();
  });
});
