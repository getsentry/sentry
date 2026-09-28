import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';

function renderList(props: Partial<Parameters<typeof PathMappingList>[0]> = {}) {
  return render(<PathMappingList onChange={() => {}} {...props} />);
}

const MAPPINGS: PathMappingValue[] = [
  {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
  {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'frontend'},
];

describe('PathMappingList', () => {
  describe('empty', () => {
    it('starts with a single new mapping open for editing', () => {
      renderList();

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {name: /stack trace prefix/i})
      ).toBeInTheDocument();
    });

    it('reports filled values through onChange', async () => {
      const onChange = jest.fn();
      renderList({onChange});

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'lib/'
      );

      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({stackRoot: 'lib/', branch: 'main'}),
      ]);
    });

    it('pins the summary when reopening a filled row that was collapsed', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'app/'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));

      expect(
        screen.getByRole('button', {name: 'Collapse path mapping'})
      ).toBeInTheDocument();
    });
  });

  describe('with existing mappings', () => {
    it('renders each mapping as a collapsed summary', () => {
      renderList({pathMappings: MAPPINGS});

      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();
      expect(screen.getByText('app/')).toBeInTheDocument();
      expect(screen.getByText('src/')).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', {name: /stack trace prefix/i})
      ).not.toBeInTheDocument();
    });

    it('expands a single mapping at a time', async () => {
      renderList({pathMappings: MAPPINGS});

      const [first, second] = screen.getAllByRole('button', {
        name: 'Expand path mapping',
      });

      await userEvent.click(first!);
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue(
        'app/'
      );

      await userEvent.click(second!);
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue(
        'src/'
      );
      expect(screen.getAllByRole('textbox', {name: /stack trace prefix/i})).toHaveLength(
        1
      );
    });

    it('adds a new mapping when "Add another path" is clicked', async () => {
      renderList({pathMappings: MAPPINGS});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(screen.getByText(/Paths \(3\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue('');
    });

    it('removes a mapping and reports the change', async () => {
      const onChange = jest.fn();
      renderList({pathMappings: MAPPINGS, onChange});

      const [firstDelete] = screen.getAllByRole('button', {name: 'Delete path mapping'});
      await userEvent.click(firstDelete!);

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({stackRoot: 'src/'}),
      ]);
    });

    it('falls back to a fresh open row when the last mapping is deleted', async () => {
      const onChange = jest.fn();
      renderList({pathMappings: [MAPPINGS[0]!], onChange});

      await userEvent.click(screen.getByRole('button', {name: 'Delete path mapping'}));

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue('');
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({stackRoot: '', sourceRoot: ''}),
      ]);
    });
  });

  describe('duplicate mappings', () => {
    it('blocks adding another path until the duplicate is resolved', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      ];
      renderList({pathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add another path'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('treats an empty branch as a duplicate of the default branch', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: ''},
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      ];
      renderList({pathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add another path'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('treats src and src/ as the same stack root', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'src', sourceRoot: 'src/app/', branch: 'main'},
        {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
      ];
      renderList({pathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add another path'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('add another path', () => {
    it('reopens a trailing empty row instead of stacking a new one', async () => {
      renderList({pathMappings: [MAPPINGS[0]!]});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue(
        'app/'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue('');
    });
  });

  describe('defaultBranch', () => {
    it('seeds the initial row with the provided default branch', () => {
      const onChange = jest.fn();
      renderList({defaultBranch: 'master', onChange});

      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({branch: 'master'}),
      ]);
    });

    it('seeds new rows added via "Add another path" with the provided default branch', async () => {
      const onChange = jest.fn();
      renderList({pathMappings: [MAPPINGS[0]!], defaultBranch: 'master', onChange});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(onChange).toHaveBeenLastCalledWith([
        MAPPINGS[0],
        expect.objectContaining({stackRoot: '', sourceRoot: '', branch: 'master'}),
      ]);
    });
  });

  describe('catch-all and exact-duplicate warnings', () => {
    it('shows the catch-all alert when the expanded row has an empty stack root', async () => {
      renderList();

      // The initial row is empty (catch-all state).
      expect(
        await screen.findByText(
          'This mapping matches every path because the stack trace prefix is empty. Add a specific path if you only want it to apply to some files.'
        )
      ).toBeInTheDocument();
    });

    it('hides the catch-all alert once a stack root is entered', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src/'
      );

      expect(
        screen.queryByText(
          'This mapping matches every path because the stack trace prefix is empty. Add a specific path if you only want it to apply to some files.'
        )
      ).not.toBeInTheDocument();
    });

    it('does not warn when roots are unrelated', () => {
      renderList({
        pathMappings: [
          {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
        ],
      });

      // No warning icon on either collapsed row.
      expect(screen.queryByRole('img', {name: 'Warning'})).not.toBeInTheDocument();
    });

    it('shows warning icon and expanded alert for two identical stack roots', async () => {
      renderList({
        pathMappings: [
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
        ],
      });

      // Both rows share the same stack root — each gets a warning icon.
      expect(screen.getAllByRole('img', {name: 'Warning'})).toHaveLength(2);

      const [firstExpand] = screen.getAllByRole('button', {name: 'Expand path mapping'});
      await userEvent.click(firstExpand!);

      expect(screen.getByText(/Only one can be used for matching/)).toBeInTheDocument();
    });

    it('still only disables add-another when roots are exact duplicates, not distinct pairs', () => {
      renderList({
        pathMappings: [
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
          {stackRoot: 'src/app/', sourceRoot: 'dist/', branch: 'main'},
        ],
      });

      // Different (stackRoot, sourceRoot) pairs — add is NOT disabled.
      expect(screen.getByRole('button', {name: 'Add another path'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('field normalization', () => {
    it('adds a trailing slash to the stack root on blur', async () => {
      const onChange = jest.fn();
      renderList({onChange});

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src'
      );
      await userEvent.tab();

      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({stackRoot: 'src/'}),
      ]);
    });

    it('converts invalid branch characters to dashes', async () => {
      const onChange = jest.fn();
      renderList({onChange});

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src/'
      );
      // Clear the pre-seeded default branch before typing a custom value.
      await userEvent.clear(screen.getByRole('textbox', {name: /branch/i}));
      await userEvent.type(screen.getByRole('textbox', {name: /branch/i}), 'my branch');

      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({branch: 'my-branch'}),
      ]);
    });
  });
});
