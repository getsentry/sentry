import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Onboarding from 'sentry/views/performance/onboarding';

describe('Performance Onboarding View > Unsupported Banner', function () {
  const organization = OrganizationFixture();

  it('Displays unsupported banner for unsupported projects', function () {
    const project = ProjectFixture({
      platform: 'nintendo-switch',
    });
    render(<Onboarding organization={organization} project={project} />);

    expect(screen.getByTestId('unsupported-alert')).toBeInTheDocument();
  });

  it('Does not display unsupported banner for supported projects', function () {
    const project = ProjectFixture({
      platform: 'java',
    });
    render(<Onboarding organization={organization} project={project} />);

    expect(screen.queryByTestId('unsupported-alert')).not.toBeInTheDocument();
  });
});
