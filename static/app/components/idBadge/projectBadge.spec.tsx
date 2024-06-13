import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';

describe('ProjectBadge', function () {
  it('renders with Avatar and team name', function () {
    render(<ProjectBadge project={ProjectFixture()} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/project-slug/?project=2'
    );
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('project-slug');
  });
});
