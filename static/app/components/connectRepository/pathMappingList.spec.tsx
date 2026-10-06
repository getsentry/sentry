import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';

const MAPPINGS: PathMappingValue[] = [
  {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
  {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'frontend'},
];

/**
 * Mirrors how ConnectRepositoryModal uses PathMappingList: the form is seeded
 * with at least one row before the list mounts (or with the provided mappings).
 */
function renderList({
  initialPathMappings,
  defaultBranch,
  providerKey,
}: {
  defaultBranch?: string;
  initialPathMappings?: PathMappingValue[];
  providerKey?: string;
} = {}) {
  const branchSeed = defaultBranch ?? 'main';
  const seeded = initialPathMappings ?? [
    {stackRoot: '', sourceRoot: '', branch: branchSeed},
  ];

  function Wrapper() {
    const form = useScrapsForm({
      ...defaultFormOptions,
      defaultValues: {repository: null as string | null, pathMappings: seeded},
      onSubmit: () => {},
    });
    return (
      <form.AppForm form={form}>
        <PathMappingList
          form={form}
          defaultBranch={defaultBranch}
          providerKey={providerKey}
        />
      </form.AppForm>
    );
  }
  return render(<Wrapper />);
}

describe('PathMappingList', () => {
  describe('empty', () => {
    it('starts with a single new mapping open for editing', () => {
      renderList();

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {name: /stack trace prefix/i})
      ).toBeInTheDocument();
    });

    it('updates the input as the user types', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'lib/'
      );

      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue(
        'lib/'
      );
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
      renderList({initialPathMappings: MAPPINGS});

      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();
      expect(screen.getByText('app/')).toBeInTheDocument();
      expect(screen.getByText('src/')).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', {name: /stack trace prefix/i})
      ).not.toBeInTheDocument();
    });

    it('expands a single mapping at a time', async () => {
      renderList({initialPathMappings: MAPPINGS});

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
      renderList({initialPathMappings: MAPPINGS});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(screen.getByText(/Paths \(3\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue('');
    });

    it('removes a mapping', async () => {
      renderList({initialPathMappings: MAPPINGS});

      const [firstDelete] = screen.getAllByRole('button', {name: 'Delete path mapping'});
      await userEvent.click(firstDelete!);

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(screen.getByText('src/')).toBeInTheDocument();
      expect(screen.queryByText('app/')).not.toBeInTheDocument();
    });

    it('falls back to a fresh open row when the last mapping is deleted', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!]});

      await userEvent.click(screen.getByRole('button', {name: 'Delete path mapping'}));

      expect(screen.getByText(/Paths \(1\)/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue('');
    });
  });

  describe('duplicate mappings', () => {
    it('blocks adding another path until the duplicate is resolved', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      ];
      renderList({initialPathMappings: duplicates});

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
      renderList({initialPathMappings: duplicates});

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
      renderList({initialPathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add another path'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('add another path', () => {
    it('blocks adding a third empty row as a duplicate of the second', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!]});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
      expect(screen.getByText(/Paths \(2\)/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));
      expect(screen.getByText(/Paths \(3\)/)).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Add another path'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('defaultBranch', () => {
    it('seeds the initial row with the provided default branch', () => {
      renderList({defaultBranch: 'master'});

      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('master');
    });

    it('seeds new rows added via "Add another path" with the provided default branch', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!], defaultBranch: 'master'});

      await userEvent.click(screen.getByRole('button', {name: 'Add another path'}));

      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('master');
    });
  });

  describe('field normalization', () => {
    it('adds a trailing slash to the stack root on blur', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src'
      );
      await userEvent.tab();

      expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveValue(
        'src/'
      );
    });

    it('converts invalid branch characters to dashes', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src/'
      );
      await userEvent.clear(screen.getByRole('textbox', {name: /branch/i}));
      await userEvent.type(screen.getByRole('textbox', {name: /branch/i}), 'my branch');

      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('my-branch');
    });
  });
});
