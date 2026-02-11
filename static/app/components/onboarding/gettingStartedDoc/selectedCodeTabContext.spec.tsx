import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import type {CodeSnippetTab} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {
  StepIndexProvider,
  TabSelectionScope,
} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';

const PACKAGE_MANAGER_TABS: CodeSnippetTab[] = [
  {label: 'npm', value: 'npm', code: 'npm install @sentry/node', language: 'bash'},
  {label: 'yarn', value: 'yarn', code: 'yarn add @sentry/node', language: 'bash'},
  {label: 'pnpm', value: 'pnpm', code: 'pnpm add @sentry/node', language: 'bash'},
];

const MODULE_FORMAT_TABS: CodeSnippetTab[] = [
  {
    label: 'ESM',
    value: 'ESM',
    code: 'import * as Sentry from "@sentry/node"',
    language: 'javascript',
  },
  {
    label: 'CJS',
    value: 'CJS',
    code: 'const Sentry = require("@sentry/node")',
    language: 'javascript',
  },
];

function GuidedStepsWithTabs() {
  return (
    <TabSelectionScope>
      <GuidedSteps>
        <GuidedSteps.Step stepKey="install" title="Install">
          <StepIndexProvider index={0}>
            <TabbedCodeSnippet tabs={PACKAGE_MANAGER_TABS} />
          </StepIndexProvider>
          <GuidedSteps.ButtonWrapper>
            <GuidedSteps.NextButton size="md" />
          </GuidedSteps.ButtonWrapper>
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="configure" title="Configure">
          <StepIndexProvider index={1}>
            <TabbedCodeSnippet tabs={MODULE_FORMAT_TABS} />
          </StepIndexProvider>
          <GuidedSteps.ButtonWrapper>
            <GuidedSteps.BackButton size="md" />
            <GuidedSteps.NextButton size="md" />
          </GuidedSteps.ButtonWrapper>
        </GuidedSteps.Step>
        <GuidedSteps.Step stepKey="verify" title="Verify">
          <StepIndexProvider index={2}>
            <TabbedCodeSnippet tabs={PACKAGE_MANAGER_TABS} />
          </StepIndexProvider>
          <GuidedSteps.ButtonWrapper>
            <GuidedSteps.BackButton size="md" />
          </GuidedSteps.ButtonWrapper>
        </GuidedSteps.Step>
      </GuidedSteps>
    </TabSelectionScope>
  );
}

describe('TabSelectionScope with GuidedSteps', () => {
  it('defaults to the first tab', () => {
    render(<GuidedStepsWithTabs />);

    // npm tab is selected by default (first tab)
    expect(screen.getByText('npm install @sentry/node')).toBeInTheDocument();
  });

  it('persists tab selection after navigating forward and back', async () => {
    render(<GuidedStepsWithTabs />);

    // Select yarn in step 0
    await userEvent.click(screen.getByRole('button', {name: 'yarn'}));
    expect(screen.getByText('yarn add @sentry/node')).toBeInTheDocument();

    // Navigate to step 1 (Configure)
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    // Step 1 shows ESM by default
    expect(
      screen.getByText('import * as Sentry from "@sentry/node"')
    ).toBeInTheDocument();

    // Navigate back to step 0 (Install)
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    // yarn selection should be preserved
    expect(screen.getByText('yarn add @sentry/node')).toBeInTheDocument();
  });

  it('maintains independent selections per step', async () => {
    render(<GuidedStepsWithTabs />);

    // Select pnpm in step 0 (Install)
    await userEvent.click(screen.getByRole('button', {name: 'pnpm'}));
    expect(screen.getByText('pnpm add @sentry/node')).toBeInTheDocument();

    // Navigate to step 1 (Configure) and select CJS
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'CJS'}));
    expect(
      screen.getByText('const Sentry = require("@sentry/node")')
    ).toBeInTheDocument();

    // Navigate to step 2 (Verify) — same tabs as step 0 but different step index
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    // Step 2 should default to npm (independent from step 0's pnpm selection)
    expect(screen.getByText('npm install @sentry/node')).toBeInTheDocument();

    // Navigate back to step 1 — CJS should still be selected
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(
      screen.getByText('const Sentry = require("@sentry/node")')
    ).toBeInTheDocument();

    // Navigate back to step 0 — pnpm should still be selected
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(screen.getByText('pnpm add @sentry/node')).toBeInTheDocument();
  });

  it('does not show code from unselected tabs', async () => {
    render(<GuidedStepsWithTabs />);

    // Default is npm
    expect(screen.getByText('npm install @sentry/node')).toBeInTheDocument();
    expect(screen.queryByText('yarn add @sentry/node')).not.toBeInTheDocument();
    expect(screen.queryByText('pnpm add @sentry/node')).not.toBeInTheDocument();

    // Switch to yarn
    await userEvent.click(screen.getByRole('button', {name: 'yarn'}));
    expect(screen.queryByText('npm install @sentry/node')).not.toBeInTheDocument();
    expect(screen.getByText('yarn add @sentry/node')).toBeInTheDocument();
    expect(screen.queryByText('pnpm add @sentry/node')).not.toBeInTheDocument();
  });
});

describe('TabSelectionScope isolation', () => {
  it('isolates selections between separate TabSelectionScope instances', async () => {
    render(
      <div>
        <div data-test-id="scope-a">
          <TabSelectionScope>
            <StepIndexProvider index={0}>
              <TabbedCodeSnippet tabs={PACKAGE_MANAGER_TABS} />
            </StepIndexProvider>
          </TabSelectionScope>
        </div>
        <div data-test-id="scope-b">
          <TabSelectionScope>
            <StepIndexProvider index={0}>
              <TabbedCodeSnippet tabs={PACKAGE_MANAGER_TABS} />
            </StepIndexProvider>
          </TabSelectionScope>
        </div>
      </div>
    );

    const scopeA = within(screen.getByTestId('scope-a'));
    const scopeB = within(screen.getByTestId('scope-b'));

    // Both default to npm
    expect(scopeA.getByText('npm install @sentry/node')).toBeInTheDocument();
    expect(scopeB.getByText('npm install @sentry/node')).toBeInTheDocument();

    // Select yarn in scope A
    await userEvent.click(scopeA.getByRole('button', {name: 'yarn'}));

    // Scope A shows yarn, scope B still shows npm
    expect(scopeA.getByText('yarn add @sentry/node')).toBeInTheDocument();
    expect(scopeB.getByText('npm install @sentry/node')).toBeInTheDocument();
  });
});
