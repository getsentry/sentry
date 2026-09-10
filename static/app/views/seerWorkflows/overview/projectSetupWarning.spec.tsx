import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectSetupWarning} from './projectSetupWarning';
import type {ProjectConfig} from './types';

function project(slug: string): ProjectConfig {
  return {id: slug, slug, hasReposConnected: false};
}

async function openTooltip() {
  await userEvent.hover(screen.getByLabelText('Seer setup warning'));
}

describe('ProjectSetupWarning', () => {
  it('counts a single project and links to org Seer settings', async () => {
    render(
      <ProjectSetupWarning unconfiguredProjects={[project('alpha')]} orgSlug="acme" />
    );

    await openTooltip();

    expect(await screen.findByText(/Seer automation isn't set up for/)).toHaveTextContent(
      "Seer automation isn't set up for 1 project in the current filter. Enable automation"
    );
    expect(screen.getByRole('link', {name: 'Enable automation'})).toHaveAttribute(
      'href',
      '/settings/acme/seer/'
    );
  });

  it('is hidden on small screens', () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 375;
    try {
      const {container} = render(
        <ProjectSetupWarning unconfiguredProjects={[project('alpha')]} orgSlug="acme" />
      );
      expect(container).toBeEmptyDOMElement();
    } finally {
      window.innerWidth = originalWidth;
    }
  });

  it('pluralizes the project count', async () => {
    render(
      <ProjectSetupWarning
        unconfiguredProjects={[project('alpha'), project('beta'), project('gamma')]}
        orgSlug="acme"
      />
    );

    await openTooltip();

    expect(await screen.findByText(/Seer automation isn't set up for/)).toHaveTextContent(
      "Seer automation isn't set up for 3 projects in the current filter. Enable automation"
    );
  });
});
