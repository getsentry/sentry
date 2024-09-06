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
    custom_replay_value: 123,
  };

  it('does not render replay id with button', function () {
    // we removed replay ID from the replay context
    // but should still show custom values.
    render(<ReplayEventContext data={replayContext} event={event} />, {organization});

    expect(screen.queryByText('Replay ID')).not.toBeInTheDocument();
    expect(screen.queryByText(replayId)).not.toBeInTheDocument();
    expect(screen.getByText('custom_replay_value')).toBeInTheDocument();
  });
});
