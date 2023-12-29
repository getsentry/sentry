import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import DeployBadge from 'sentry/components/deployBadge';
import type {Deploy} from 'sentry/types';

const deploy: Deploy = {
  name: '85fedddce5a61a58b160fa6b3d6a1a8451e94eb9 to prod',
  url: '',
  environment: 'production',
  dateStarted: '2020-05-11T18:12:00.025928Z',
  dateFinished: '2020-05-11T18:12:00.025928Z',
  version: '4.2.0',
  id: '6348842',
};

describe('DeployBadge', () => {
  it('renders', () => {
    render(<DeployBadge deploy={deploy} />);

    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deploy-open-icon')).not.toBeInTheDocument();
  });

  it('renders with link', () => {
    const projectId = 1;
    render(
      <DeployBadge
        deploy={deploy}
        orgSlug="sentry"
        version="1.2.3"
        projectId={projectId}
      />,
      {context: RouterContextFixture()}
    );

    expect(screen.queryByRole('link')).toHaveAttribute(
      'href',
      `/organizations/sentry/issues/?environment=${deploy.environment}&project=${projectId}&query=release%3A1.2.3`
    );
    expect(screen.getByText('production')).toBeInTheDocument();
  });
});
