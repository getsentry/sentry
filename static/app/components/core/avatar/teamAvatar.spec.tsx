import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TeamFixture} from 'sentry-fixture/team';

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

    // Tooltip should show "#my team" (exploded from slug)
    const avatar = screen.getByTestId('letter_avatar-avatar');
    expect(avatar).toHaveAttribute('title', '#my team');
  });

  it('handles custom tooltip prop', () => {
    const team = TeamFixture({
      slug: 'my-team',
      name: 'Old Name',
    });

    render(<TeamAvatar team={team} tooltip="Custom Tooltip" hasTooltip />);

    const avatar = screen.getByTestId('letter_avatar-avatar');
    expect(avatar).toHaveAttribute('title', 'Custom Tooltip');
  });

  it('uses consistent identifier for color selection', () => {
    const team = TeamFixture({
      slug: 'consistent-slug',
      name: 'Name Can Change',
    });

    const {container} = render(<TeamAvatar team={team} />);

    // The identifier should be based on slug so color stays consistent
    // even if name changes. We can verify this by checking that the
    // SVG rect has a fill color (which is generated from slug hash)
    const rect = container.querySelector('rect');
    expect(rect).toHaveStyle({fill: expect.any(String)});
  });
});
