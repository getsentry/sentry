import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {SuggestedAvatarStack} from 'sentry/components/suggestedAvatarStack';
import type {Actor} from 'sentry/types/core';

const OWNERS: Actor[] = [
  {id: '1', name: 'Alpha', type: 'user'},
  {id: '2', name: 'Beta', type: 'user'},
  {id: '3', name: 'Charlie', type: 'user'},
  {id: '4', name: 'Delta', type: 'user'},
  {id: '5', name: 'Echo', type: 'user'},
];

function getRenderedInitials() {
  return within(screen.getByTestId('suggested-avatar-stack'))
    .getAllByTestId('letter_avatar-avatar')
    .map(avatar => avatar.textContent);
}

describe('SuggestedAvatarStack', () => {
  it('renders owners in their original order by default', () => {
    render(<SuggestedAvatarStack owners={OWNERS.slice(0, 3)} />);

    expect(getRenderedInitials()).toEqual(['A', 'B', 'C']);
  });

  it('renders owners in reverse order when reverse is false', () => {
    render(<SuggestedAvatarStack owners={OWNERS.slice(0, 3)} reverse={false} />);

    expect(getRenderedInitials()).toEqual(['C', 'B', 'A']);
  });

  it('renders at most three owners', () => {
    render(<SuggestedAvatarStack owners={OWNERS} />);

    expect(getRenderedInitials()).toEqual(['A', 'B', 'C']);
  });

  it('renders nothing when there are no owners', () => {
    render(<SuggestedAvatarStack owners={[]} />);

    expect(screen.queryByTestId('suggested-avatar-stack')).not.toBeInTheDocument();
  });
});
