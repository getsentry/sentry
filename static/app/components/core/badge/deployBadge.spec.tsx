import {DeployFixture} from 'sentry-fixture/deploy';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DeployBadge} from 'sentry/components/core/badge/deployBadge';

describe('DeployBadge', () => {
  const deploy = DeployFixture();

  it('renders with link', () => {
    const projectId = 1;
    render(
      <DeployBadge
        deploy={deploy}
        orgSlug="sentry"
        version="1.2.3"
        projectId={projectId}
      />
    );

    expect(screen.queryByRole('link')).toHaveAttribute(
      'href',
      `/organizations/sentry/issues/?environment=${deploy.environment}&project=${projectId}&query=release%3A1.2.3`
    );
    expect(screen.getByText('production')).toBeInTheDocument();
  });
});
