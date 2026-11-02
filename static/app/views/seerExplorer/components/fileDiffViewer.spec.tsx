import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DiffFileType,
  DiffLineType,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

const patch: FilePatch = {
  path: 'src/app.py',
  type: DiffFileType.MODIFIED,
  added: 1,
  removed: 1,
  source_file: 'src/app.py',
  target_file: 'src/app.py',
  hunks: [
    {
      section_header: '',
      source_start: 40,
      source_length: 1,
      target_start: 40,
      target_length: 1,
      lines: [
        {
          diff_line_no: 1,
          line_type: DiffLineType.REMOVED,
          source_line_no: 40,
          target_line_no: null,
          value: 'old_line()\n',
        },
        {
          diff_line_no: 2,
          line_type: DiffLineType.ADDED,
          source_line_no: null,
          target_line_no: 40,
          value: 'new_line()\n',
        },
      ],
    },
  ],
};

const fileUrl = 'https://github.com/org/repo/blob/abc123/src/app.py';

describe('FileDiffViewer', () => {
  it('shows an open-file button when a file URL is provided', () => {
    render(<FileDiffViewer patch={patch} fileUrl={fileUrl} />);

    const button = screen.getByRole('button', {name: 'Open file in repository'});
    expect(button).toHaveAttribute('href', fileUrl);
    expect(button).toHaveAttribute('target', '_blank');
    expect(screen.getByText('src/app.py')).toBeInTheDocument();
  });

  it('renders no open-file button without a file URL', () => {
    render(<FileDiffViewer patch={patch} />);

    expect(screen.getByText('src/app.py')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Open file in repository'})
    ).not.toBeInTheDocument();
  });

  it('does not render the button for non-http URLs', () => {
    // eslint-disable-next-line no-script-url
    render(<FileDiffViewer patch={patch} fileUrl="javascript:alert(1)" />);

    expect(
      screen.queryByRole('button', {name: 'Open file in repository'})
    ).not.toBeInTheDocument();
  });

  it('does not toggle a collapsible diff when the button is clicked', async () => {
    render(
      <FileDiffViewer patch={patch} fileUrl={fileUrl} collapsible defaultExpanded />
    );

    expect(screen.getByText('new_line()')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Open file in repository'}));

    expect(screen.getByText('new_line()')).toBeInTheDocument();
  });
});
