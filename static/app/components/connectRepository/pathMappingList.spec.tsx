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

    it('disables "Add another path" while the empty row is being edited', () => {
      renderList();

      expect(screen.getByRole('button', {name: 'Add another path'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
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
      await userEvent.type(screen.getByRole('textbox', {name: /branch/i}), 'my branch');

      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({branch: 'my-branch'}),
      ]);
    });
  });
});
