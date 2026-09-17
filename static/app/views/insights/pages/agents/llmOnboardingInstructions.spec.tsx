import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  getAgentSetupPrompt,
  ManualInstrumentationNote,
} from './llmOnboardingInstructions';

describe('getAgentSetupPrompt', () => {
  it.each(['node', undefined] as const)(
    'includes project context and documentation links for platform %s',
    platform => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({platform});
      const dsn = ProjectKeysFixture()[0].dsn.public;

      const prompt = getAgentSetupPrompt({
        organizationSlug: organization.slug,
        project,
        dsn,
      });

      expect(prompt).toContain(`${organization.slug}/${project.slug}`);
      expect(prompt).toContain(dsn);
      expect(prompt).toContain(`Platform hint: ${platform ?? 'unknown'}`);
      expect(prompt).toContain('https://skills.sentry.dev/instrument');
      expect(prompt).toContain('https://docs.sentry.io/ai/agent-plugin/');
    }
  );
});

describe('ManualInstrumentationNote', () => {
  const docsLink = <a href="https://docs.sentry.io">docs</a>;

  it('renders "Copy instructions" text', () => {
    const organization = OrganizationFixture();

    render(<ManualInstrumentationNote docsLink={docsLink} />, {organization});

    expect(screen.getByText(/Copy instructions/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
  });
});
