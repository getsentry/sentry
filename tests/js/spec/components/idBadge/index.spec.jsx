import {render, screen} from 'sentry-test/reactTestingLibrary';

import IdBadge from 'sentry/components/idBadge';

describe('IdBadge', function () {
  it('renders the correct component when `user` property is passed', function () {
    const user = TestStubs.User();
    render(<IdBadge user={user} />);

    expect(screen.getByTestId('letter_avatar-avatar')).toHaveTextContent('FB');
    expect(screen.getByText(user.email)).toBeInTheDocument();
  });

  it('renders the correct component when `team` property is passed', function () {
    render(<IdBadge team={TestStubs.Team()} />);

    expect(screen.getByTestId('badge-styled-avatar')).toHaveTextContent('TS');
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('#team-slug');
  });

  it('renders the correct component when `project` property is passed', function () {
    render(<IdBadge project={TestStubs.Project()} />);

    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('project-slug');
  });

  it('renders the correct component when `organization` property is passed', function () {
    render(<IdBadge organization={TestStubs.Organization()} />);

    expect(screen.getByTestId('badge-styled-avatar')).toHaveTextContent('OS');
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('org-slug');
  });

  it('throws when no valid properties are passed', function () {
    expect(() => render(<IdBadge />)).toThrow();
  });
});
