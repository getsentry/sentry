import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';

describe('ProjectBadge', () => {
  it('renders with Avatar and team name', () => {
    render(<ProjectBadge project={ProjectFixture()} />);

    // The project avatar renders a decorative platform icon (alt=""), queried
    // by test id rather than the img role.
    expect(screen.getByTestId('platform-icon-default')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/projects/project-slug/?project=2'
    );
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('project-slug');
  });
});
