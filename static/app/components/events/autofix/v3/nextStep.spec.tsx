import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {SeerDrawerNextStep} from './nextStep';

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState: {run_id: 1} as any,
    startStep: jest.fn(),
    createPR: jest.fn(),
    sendMessage: jest.fn(),
    reset: jest.fn(),
    isLoading: false,
    isReady: true,
    isStreaming: false,
    ...overrides,
  } as ReturnType<typeof useExplorerAutofix>;
}

function makeSection(step: string): AutofixSection {
  return {
    step,
    artifacts: [],
    messages: [],
    status: 'completed',
  };
}

describe('SeerDrawerNextStep', () => {
  it('returns null when no runId', () => {
    const autofix = makeAutofix({runState: null});
    const {container} = render(<SeerDrawerNextStep sections={[]} autofix={autofix} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when sections are empty', () => {
    const autofix = makeAutofix();
    const {container} = render(<SeerDrawerNextStep sections={[]} autofix={autofix} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('RootCauseNextStep', () => {
    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('root_cause')]} autofix={autofix} />
      );
      expect(screen.getByText('Are you happy with this root cause?')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Yes, make an implementation plan'})
      ).toBeInTheDocument();
    });

    it('calls startStep with solution on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('root_cause')]} autofix={autofix} />
      );
      await userEvent.click(
        screen.getByRole('button', {name: 'Yes, make an implementation plan'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith('solution', 1);
    });

    it('calls startStep with root_cause on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('root_cause')]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(autofix.startStep).toHaveBeenCalledWith('root_cause', 1);
    });
  });

  describe('SolutionNextStep', () => {
    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('solution')]} autofix={autofix} />
      );
      expect(
        screen.getByText('Are you happy with this implementation plan?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Yes, write a code fix'})
      ).toBeInTheDocument();
    });

    it('calls startStep with code_changes on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('solution')]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, write a code fix'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', 1);
    });

    it('calls startStep with solution on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('solution')]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(autofix.startStep).toHaveBeenCalledWith('solution', 1);
    });
  });

  describe('CodeChangesNextStep', () => {
    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('code_changes')]} autofix={autofix} />
      );
      expect(
        screen.getByText('Are you happy with these code changes?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Yes, draft a PR'})).toBeInTheDocument();
    });

    it('calls createPR on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('code_changes')]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, draft a PR'}));
      expect(autofix.createPR).toHaveBeenCalledWith(1);
    });

    it('calls startStep with code_changes on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep sections={[makeSection('code_changes')]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', 1);
    });
  });
});
