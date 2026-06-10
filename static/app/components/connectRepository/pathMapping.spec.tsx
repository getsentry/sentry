import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PathMapping} from 'sentry/components/connectRepository/pathMapping';

interface OverrideProps {
  branch?: string;
  editing?: boolean;
  isNew?: boolean;
  onChange?: (value: {branch: string; sourceRoot: string; stackRoot: string}) => void;
  onDelete?: () => void;
  onExpandToggle?: () => void;
  sourceRoot?: string;
  stackRoot?: string;
}

function renderPathMapping(props: OverrideProps = {}) {
  return render(
    <PathMapping
      stackRoot="app/"
      sourceRoot="static/app/"
      branch="main"
      editing={false}
      isNew={false}
      onChange={() => {}}
      onDelete={() => {}}
      onExpandToggle={() => {}}
      {...props}
    />
  );
}

describe('PathMapping', () => {
  describe('collapsed summary', () => {
    it('renders the rewritten path and branch without the form', () => {
      renderPathMapping();

      expect(screen.getByText('app/')).toBeInTheDocument();
      expect(screen.getByText('static/app/')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();

      expect(
        screen.queryByRole('textbox', {name: 'Stack trace root'})
      ).not.toBeInTheDocument();
    });

    it('shows an [empty] placeholder for an unset path', () => {
      renderPathMapping({stackRoot: ''});

      expect(screen.getByText('[empty]')).toBeInTheDocument();
    });

    it('defaults the branch to main when none is set', () => {
      renderPathMapping({branch: ''});

      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('calls onExpandToggle when the expand control is clicked', async () => {
      const onExpandToggle = jest.fn();
      renderPathMapping({onExpandToggle});

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));

      expect(onExpandToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when the delete control is clicked', async () => {
      const onDelete = jest.fn();
      renderPathMapping({onDelete});

      await userEvent.click(screen.getByRole('button', {name: 'Delete path mapping'}));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('editing', () => {
    it('shows the form pre-filled and keeps the summary for existing mappings', () => {
      renderPathMapping({editing: true, isNew: false});

      expect(screen.getByRole('textbox', {name: 'Stack trace root'})).toHaveValue('app/');
      expect(screen.getByRole('textbox', {name: 'Source code root'})).toHaveValue(
        'static/app/'
      );
      expect(screen.getByRole('textbox', {name: 'Branch'})).toHaveValue('main');

      expect(
        screen.getByRole('button', {name: 'Collapse path mapping'})
      ).toBeInTheDocument();
    });

    it('hides the summary while editing a new mapping', () => {
      renderPathMapping({editing: true, isNew: true});

      expect(screen.getByRole('textbox', {name: 'Stack trace root'})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Collapse path mapping'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Delete path mapping'})
      ).not.toBeInTheDocument();
    });

    it('reports edits through onChange', async () => {
      const onChange = jest.fn();
      renderPathMapping({editing: true, onChange});

      const stackTraceRoot = screen.getByRole('textbox', {name: 'Stack trace root'});
      await userEvent.clear(stackTraceRoot);
      await userEvent.type(stackTraceRoot, 'lib/');

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({stackRoot: 'lib/'})
      );
    });

    it('sanitizes invalid characters in the branch but keeps valid ones', async () => {
      const onChange = jest.fn();
      renderPathMapping({editing: true, branch: '', onChange});

      const branch = screen.getByRole('textbox', {name: 'Branch'});
      await userEvent.type(branch, 'feature/my branch');

      // Slashes are valid in git branches and are preserved; the space becomes
      // a dash.
      expect(branch).toHaveValue('feature/my-branch');
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({branch: 'feature/my-branch'})
      );
    });

    it('keeps a trailing dash (valid in git branch names)', async () => {
      const onChange = jest.fn();
      renderPathMapping({editing: true, branch: '', onChange});

      const branch = screen.getByRole('textbox', {name: 'Branch'});
      await userEvent.type(branch, 'wip-');

      expect(branch).toHaveValue('wip-');
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({branch: 'wip-'})
      );
    });

    it('does not rewrite a valid existing branch when editing other fields', async () => {
      const onChange = jest.fn();
      renderPathMapping({editing: true, branch: 'feature/foo_bar.1', onChange});

      const stackTraceRoot = screen.getByRole('textbox', {name: 'Stack trace root'});
      await userEvent.type(stackTraceRoot, 'x');

      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({branch: 'feature/foo_bar.1'})
      );
    });

    it('renders the preview example', () => {
      renderPathMapping({editing: true});

      expect(screen.getByText('In your stack trace')).toBeInTheDocument();
      expect(screen.getByText('Sentry opens in your repo')).toBeInTheDocument();
    });
  });
});
