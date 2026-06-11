import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PathMappingValue} from 'sentry/components/connectRepository/pathMapping';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';

function renderPathMappingList(
  props: Partial<Parameters<typeof PathMappingList>[0]> = {}
) {
  return render(<PathMappingList onChange={() => {}} {...props} />);
}

const MAPPINGS: PathMappingValue[] = [
  {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
  {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'frontend'},
];

describe('PathMappingList', () => {
  describe('empty', () => {
    it('starts with a single new mapping open for editing', () => {
      renderPathMappingList();

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {name: 'Stack trace prefix'})
      ).toBeInTheDocument();
    });

    it('disables "Add another path" while the empty row is being edited', () => {
      renderPathMappingList();

      expect(screen.getByRole('button', {name: 'Add another path'})).toBeDisabled();
    });

    it('reports filled values through onChange', async () => {
      const onChange = jest.fn();
      renderPathMappingList({onChange});

      await userEvent.type(
        screen.getByRole('textbox', {name: 'Stack trace prefix'}),
        'lib/'
      );

      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({stackRoot: 'lib/', branch: 'main'}),
      ]);
    });

    it('pins the summary when reopening a filled row that was collapsed', async () => {
      renderPathMappingList();

      // Fill the initial new row, then collapse it by adding another.
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Stack trace prefix'}),
        'app/'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      // Reopening the now-established row should pin its summary above the
      // editor (a "Collapse" control only renders when the summary is shown).
      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));

      expect(
        screen.getByRole('button', {name: 'Collapse path mapping'})
      ).toBeInTheDocument();
    });
  });

  describe('with existing mappings', () => {
    it('renders each mapping as a collapsed summary', () => {
      renderPathMappingList({pathMappings: MAPPINGS});

      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();
      expect(screen.getByText('app/')).toBeInTheDocument();
      expect(screen.getByText('src/')).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', {name: 'Stack trace prefix'})
      ).not.toBeInTheDocument();
    });

    it('expands a single mapping at a time', async () => {
      renderPathMappingList({pathMappings: MAPPINGS});

      const [first, second] = screen.getAllByRole('button', {
        name: 'Expand path mapping',
      });

      await userEvent.click(first!);
      expect(screen.getByRole('textbox', {name: 'Stack trace prefix'})).toHaveValue(
        'app/'
      );

      await userEvent.click(second!);
      expect(screen.getByRole('textbox', {name: 'Stack trace prefix'})).toHaveValue(
        'src/'
      );
      expect(screen.getAllByRole('textbox', {name: 'Stack trace prefix'})).toHaveLength(
        1
      );
    });

    it('adds a new mapping when "Add another path" is clicked', async () => {
      renderPathMappingList({pathMappings: MAPPINGS});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(screen.getByText(/Paths \(3\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Stack trace prefix'})).toHaveValue('');
    });

    it('removes a mapping and reports the change', async () => {
      const onChange = jest.fn();
      renderPathMappingList({pathMappings: MAPPINGS, onChange});

      const [firstDelete] = screen.getAllByRole('button', {
        name: 'Delete path mapping',
      });
      await userEvent.click(firstDelete!);

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({stackRoot: 'src/'}),
      ]);
    });

    it('falls back to a fresh open row when the last mapping is deleted', async () => {
      const onChange = jest.fn();
      renderPathMappingList({pathMappings: [MAPPINGS[0]!], onChange});

      await userEvent.click(screen.getByRole('button', {name: 'Delete path mapping'}));

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Stack trace prefix'})).toHaveValue('');
      expect(onChange).toHaveBeenLastCalledWith([]);
    });
  });

  describe('duplicate mappings', () => {
    it('blocks adding another path until the duplicate is resolved', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      ];
      renderPathMappingList({pathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add another path'})).toBeDisabled();
    });

    it('treats an empty branch as a duplicate of the default branch', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: ''},
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      ];
      renderPathMappingList({pathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add another path'})).toBeDisabled();
    });
  });

  describe('add another path', () => {
    it('reopens a trailing empty row instead of stacking a new one', async () => {
      renderPathMappingList({pathMappings: [MAPPINGS[0]!]});

      // Add a new empty row, then collapse it by expanding the existing one.
      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));
      expect(screen.getByRole('textbox', {name: 'Stack trace prefix'})).toHaveValue(
        'app/'
      );

      // The trailing empty row is now collapsed, so adding reopens it rather
      // than appending a third row.
      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Stack trace prefix'})).toHaveValue('');
    });
  });
});
