import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DiffFileType,
  DiffLineType,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import {CodeChanges} from 'sentry/views/seerWorkflows/overview2/codeChanges';
import type {OverviewCodeChangeFile} from 'sentry/views/seerWorkflows/overview2/types';

function fileFixture(overrides: Partial<FilePatch> = {}): OverviewCodeChangeFile {
  return {
    repoName: 'getsentry/sentry',
    patch: {
      path: 'src/foo.py',
      source_file: 'src/foo.py',
      target_file: 'src/foo.py',
      type: DiffFileType.MODIFIED,
      added: 1,
      removed: 1,
      hunks: [
        {
          source_start: 1,
          source_length: 1,
          target_start: 1,
          target_length: 1,
          section_header: '',
          lines: [
            {
              line_type: DiffLineType.REMOVED,
              value: 'old',
              source_line_no: 1,
              target_line_no: null,
              diff_line_no: 1,
            },
            {
              line_type: DiffLineType.ADDED,
              value: 'new',
              source_line_no: null,
              target_line_no: 1,
              diff_line_no: 2,
            },
          ],
        },
      ],
      ...overrides,
    },
  };
}

describe('CodeChanges', () => {
  it('renders the generated files and expands to a diff', async () => {
    render(<CodeChanges codeChanges={[fileFixture()]} />);

    expect(screen.getByText('1 file changed')).toBeInTheDocument();
    expect(screen.getByText('src/foo.py')).toBeInTheDocument();
    // The diff stays collapsed until the file is expanded.
    expect(screen.queryByText('new')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /src\/foo\.py/}));

    expect(await screen.findByText('new')).toBeInTheDocument();
  });

  it('renders the deleted-file view for a deleted file', async () => {
    render(
      <CodeChanges
        codeChanges={[fileFixture({type: DiffFileType.DELETED, path: 'src/gone.py'})]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /src\/gone\.py/}));

    expect(await screen.findByText('This file will be deleted.')).toBeInTheDocument();
  });
});
