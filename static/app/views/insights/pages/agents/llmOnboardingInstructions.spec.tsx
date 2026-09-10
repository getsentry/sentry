import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  getAgentSetupPrompt,
  ManualInstrumentationNote,
} from './llmOnboardingInstructions';

describe('getAgentSetupPrompt', () => {
  it.each(['node', 'javascript', 'python', undefined] as const)(
    'includes project context and a platform hint for %s',
    platform => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({platform});
      const dsn = ProjectKeysFixture()[0].dsn.public;

      const prompt = getAgentSetupPrompt({
        organizationSlug: organization.slug,
        project,
        dsn,
      });

      expect(prompt).toContain(
        `Use this existing project: ${organization.slug}/${project.slug}`
      );
      expect(prompt).toContain(`DSN: ${dsn}`);
      expect(prompt).toContain(`Platform hint: ${platform || 'unknown'}`);
      expect(prompt).toContain('https://skills.sentry.dev/instrument');
      expect(prompt).toContain('agent tracing and conversations');
      expect(prompt).not.toContain('ID:');
      expect(prompt).not.toContain('confirm the stack in the codebase');
      expect(prompt).not.toContain('setup steps above');
    }
  );

  it('ends with an offer to set up the plugin using its documentation', () => {
    const prompt = getAgentSetupPrompt({
      organizationSlug: OrganizationFixture().slug,
      project: ProjectFixture(),
      dsn: ProjectKeysFixture()[0].dsn.public,
    });

    expect(prompt.split('\n\n').at(-1)).toBe(
      'Then offer to set up the [Sentry plugin](https://docs.sentry.io/ai/agent-plugin/) so I can find and fix production issues from my coding agent.'
    );
  });
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
