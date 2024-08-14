import {EventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventMetas from './eventMetas';

describe('EventMetas', () => {
  it('Displays event created and received dates when hovering', async () => {
    const event = EventFixture({
      dateReceived: '2017-05-21T18:01:48.762Z',
      dateCreated: '2017-05-21T18:02:48.762Z',
    });
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    render(
      <EventMetas
        event={event}
        location={LocationFixture()}
        organization={organization}
        errorDest="discover"
        transactionDest="discover"
        meta={null}
        projectId="1"
        quickTrace={null}
      />
    );
    await userEvent.hover(screen.getByText('5 months ago'));
    expect(await screen.findByText('Occurred')).toBeInTheDocument();
    expect(screen.getByText(/6:01:48 PM UTC/)).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText(/6:02:48 PM UTC/)).toBeInTheDocument();
  });
});
