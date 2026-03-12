import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  RootCauseArtifact,
  SolutionArtifact,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Artifact, ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

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

function makeRootCauseArtifact(): Artifact<RootCauseArtifact> {
  return {
    key: 'root-cause',
    reason: 'Found root cause',
    data: {
      one_line_description: 'Null pointer dereference',
      five_whys: ['Why 1', 'Why 2'],
    },
  };
}

function makeSolutionArtifact(): Artifact<SolutionArtifact> {
  return {
    key: 'solution',
    reason: 'Found solution',
    data: {
      one_line_summary: 'Add null check',
      steps: [{title: 'Step 1', description: 'Add guard clause'}],
    },
  };
}

function makePatch(): ExplorerFilePatch {
  return {
    repo_name: 'org/repo',
    diff: 'diff content',
    patch: {
      path: 'src/file.py',
      added: 1,
      removed: 0,
      hunks: [],
      source_file: 'src/file.py',
      target_file: 'src/file.py',
      type: 'M',
    },
  } as ExplorerFilePatch;
}

describe('SeerDrawerNextStep', () => {
  it('returns null when no runId', () => {
    const autofix = makeAutofix({runState: null});
    const {container} = render(<SeerDrawerNextStep artifacts={[]} autofix={autofix} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when artifact type does not match any case', () => {
    const autofix = makeAutofix();
    const {container} = render(<SeerDrawerNextStep artifacts={[]} autofix={autofix} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('RootCauseNextStep', () => {
    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep artifacts={[makeRootCauseArtifact()]} autofix={autofix} />
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
        <SeerDrawerNextStep artifacts={[makeRootCauseArtifact()]} autofix={autofix} />
      );
      await userEvent.click(
        screen.getByRole('button', {name: 'Yes, make an implementation plan'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith('solution', 1);
    });

    it('calls startStep with root_cause on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep artifacts={[makeRootCauseArtifact()]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(autofix.startStep).toHaveBeenCalledWith('root_cause', 1);
    });
  });

  describe('SolutionNextStep', () => {
    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep artifacts={[makeSolutionArtifact()]} autofix={autofix} />
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
        <SeerDrawerNextStep artifacts={[makeSolutionArtifact()]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, write a code fix'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', 1);
    });

    it('calls startStep with solution on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep artifacts={[makeSolutionArtifact()]} autofix={autofix} />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(autofix.startStep).toHaveBeenCalledWith('solution', 1);
    });
  });

  describe('CodeChangesNextStep', () => {
    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(<SeerDrawerNextStep artifacts={[[makePatch()]]} autofix={autofix} />);
      expect(
        screen.getByText('Are you happy with these code changes?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Yes, draft a PR'})).toBeInTheDocument();
    });

    it('calls createPR on yes click', async () => {
      const autofix = makeAutofix();
      render(<SeerDrawerNextStep artifacts={[[makePatch()]]} autofix={autofix} />);
      await userEvent.click(screen.getByRole('button', {name: 'Yes, draft a PR'}));
      expect(autofix.createPR).toHaveBeenCalledWith(1);
    });

    it('calls startStep with code_changes on no click', async () => {
      const autofix = makeAutofix();
      render(<SeerDrawerNextStep artifacts={[[makePatch()]]} autofix={autofix} />);
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', 1);
    });

    it('returns null for empty file patches array', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep artifacts={[[]]} autofix={autofix} />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });
});
