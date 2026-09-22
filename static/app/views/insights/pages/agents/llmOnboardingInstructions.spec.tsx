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

  const DATA_COLLECTION_DOCS =
    'https://docs.sentry.io/platforms/javascript/configuration/options/#dataCollection';

  it.each(['node', 'javascript-nextjs', 'bun', 'deno', undefined] as const)(
    'asks about AI inputs and outputs on %s',
    platform => {
      const prompt = getAgentSetupPrompt({
        organizationSlug: OrganizationFixture().slug,
        project: ProjectFixture({platform}),
        dsn: ProjectKeysFixture()[0]!.dsn.public,
      });

      expect(prompt).toContain('which AI inputs and outputs the SDK sends');
      expect(prompt).toContain(DATA_COLLECTION_DOCS);
    }
  );

  it.each(['python', 'python-fastapi', 'php-laravel'] as const)(
    'omits the question on %s, which does not expose dataCollection',
    platform => {
      const prompt = getAgentSetupPrompt({
        organizationSlug: OrganizationFixture().slug,
        project: ProjectFixture({platform}),
        dsn: ProjectKeysFixture()[0]!.dsn.public,
      });

      expect(prompt).not.toContain('which AI inputs and outputs the SDK sends');
      expect(prompt).not.toContain(DATA_COLLECTION_DOCS);
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
