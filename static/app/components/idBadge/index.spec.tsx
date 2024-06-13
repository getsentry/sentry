import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import IdBadge from 'sentry/components/idBadge';

describe('IdBadge', function () {
  it('renders the correct component when `user` property is passed', function () {
    const user = UserFixture();
    render(<IdBadge user={user} />);
    expect(screen.getByTestId('letter_avatar-avatar')).toHaveTextContent('FB');
    expect(screen.getByText(user.email)).toBeInTheDocument();
  });

  it('renders the correct component when `team` property is passed', function () {
    render(<IdBadge team={TeamFixture()} />);
    expect(screen.getByTestId('letter_avatar-avatar')).toHaveTextContent('TS');
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('#team-slug');
  });

  it('renders the correct component when `project` property is passed', function () {
    render(<IdBadge project={ProjectFixture()} />);
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('project-slug');
  });

  it('renders the correct component when `organization` property is passed', function () {
    render(<IdBadge organization={OrganizationFixture()} />);
    expect(screen.getByTestId('default-avatar')).toHaveTextContent('OS');
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('org-slug');
  });

  it('throws when no valid properties are passed', function () {
    // Error is expected, do not fail when calling console.error
    jest.spyOn(console, 'error').mockImplementation();
    expect(() => render(<IdBadge />)).toThrow();
  });
});
