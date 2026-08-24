import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectSetupWarning} from './projectSetupWarning';
import type {ProjectConfig} from './types';

function project(slug: string): ProjectConfig {
  return {id: slug, slug, hasReposConnected: false};
}

describe('ProjectSetupWarning', () => {
  it('names a single project and links to org Seer settings', () => {
    render(
      <ProjectSetupWarning unconfiguredProjects={[project('alpha')]} orgSlug="acme" />
    );

    expect(screen.getByText(/Seer isn't set up for/)).toHaveTextContent(
      "Seer isn't set up for alpha. Set it up here."
    );
    expect(screen.getByRole('link', {name: 'here'})).toHaveAttribute(
      'href',
      '/settings/acme/seer/'
    );
  });

  it('joins two projects with "and"', () => {
    render(
      <ProjectSetupWarning
        unconfiguredProjects={[project('alpha'), project('beta')]}
        orgSlug="acme"
      />
    );

    expect(screen.getByText(/Seer isn't set up for/)).toHaveTextContent(
      "Seer isn't set up for alpha and beta. Set it up here."
    );
  });

  it('oxford-joins three projects', () => {
    render(
      <ProjectSetupWarning
        unconfiguredProjects={[project('alpha'), project('beta'), project('gamma')]}
        orgSlug="acme"
      />
    );

    expect(screen.getByText(/Seer isn't set up for/)).toHaveTextContent(
      "Seer isn't set up for alpha, beta, and gamma. Set it up here."
    );
  });

  it('truncates past three with an "and N others" tail', () => {
    render(
      <ProjectSetupWarning
        unconfiguredProjects={[
          project('alpha'),
          project('beta'),
          project('gamma'),
          project('delta'),
          project('epsilon'),
        ]}
        orgSlug="acme"
      />
    );

    expect(screen.getByText(/Seer isn't set up for/)).toHaveTextContent(
      "Seer isn't set up for alpha, beta, gamma, and 2 others. Set it up here."
    );
  });
});
