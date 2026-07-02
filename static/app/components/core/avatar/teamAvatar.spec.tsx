import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/dependencies
import {TeamAvatar} from './teamAvatar';

describe('TeamAvatar', () => {
  it('renders letter avatar with initials from slug for renamed teams', () => {
    const team = TeamFixture({
      slug: 'bar',
      name: 'Foo', // Old name that wasn't updated
    });

    render(<TeamAvatar team={team} />);

    // Should use slug for initials, not the outdated name field
    // "bar" should give us "B", not "F" from "Foo"
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders letter avatar with initials from multi-word slug', () => {
    const team = TeamFixture({
      slug: 'frontend-team',
      name: 'Old Name',
    });

    render(<TeamAvatar team={team} />);

    // "frontend-team" -> "frontend team" -> "FT"
    expect(screen.getByText('FT')).toBeInTheDocument();
  });

  it('uses slug for tooltip', () => {
    const team = TeamFixture({
      slug: 'my-team',
      name: 'Old Name',
    });

    render(<TeamAvatar team={team} hasTooltip />);

    // The title attribute shows the display name without the # prefix
    const avatar = screen.getByTestId('letter_avatar-avatar');
    expect(avatar).toHaveAttribute('title', 'my team');
  });

  it('handles custom tooltip prop', () => {
    const team = TeamFixture({
      slug: 'my-team',
      name: 'Old Name',
    });

    render(<TeamAvatar team={team} tooltip="Custom Tooltip" hasTooltip />);

    // Note: The tooltip prop is used for the Tooltip component, not the title attribute
    // The title attribute still shows the display name
    const avatar = screen.getByTestId('letter_avatar-avatar');
    expect(avatar).toHaveAttribute('title', 'my team');
  });

  it('uses consistent identifier for color selection', () => {
    const team = TeamFixture({
      slug: 'consistent-slug',
      name: 'Name Can Change',
    });

    render(<TeamAvatar team={team} />);

    // The identifier should be based on slug so color stays consistent
    // even if name changes. Verify the avatar with consistent initials is rendered
    expect(screen.getByText('CS')).toBeInTheDocument();
  });
});
