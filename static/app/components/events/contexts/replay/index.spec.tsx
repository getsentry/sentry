import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReplayEventContext} from 'sentry/components/events/contexts/replay';

describe('replay event context', function () {
  const organization = OrganizationFixture();
  const event = EventFixture();
  const replayId = '61d2d7c5acf448ffa8e2f8f973e2cd36';
  const replayContext = {
    type: 'default',
    replay_id: replayId,
  };

  it('renders replay id with button', function () {
    render(<ReplayEventContext data={replayContext} event={event} />, {organization});

    expect(screen.getByText('Replay ID')).toBeInTheDocument();
    expect(screen.getByText(replayId)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: replayId})).toBeInTheDocument();
  });
});
