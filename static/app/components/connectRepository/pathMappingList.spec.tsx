import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';

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
  pathMappings,
  defaultBranch,
  providerKey,
  existingMappings,
}: {
  defaultBranch?: string;
  existingMappings?: RepositoryProjectPathConfig[];
  initialPathMappings?: PathMappingValue[];
  pathMappings?: PathMappingValue[];
  providerKey?: string;
} = {}) {
  const branchSeed = defaultBranch ?? 'main';
  const seeded = pathMappings ??
    initialPathMappings ?? [{stackRoot: '', sourceRoot: '', branch: branchSeed}];

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
          existingMappings={existingMappings}
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
      expect(
        screen.queryByRole('button', {name: 'Delete path mapping'})
      ).not.toBeInTheDocument();
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

    it('keeps delete on the summary when the only mapping is open', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!]});

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));

      // enableDelete is false for a single mapping, so delete stays on the summary
      expect(screen.getAllByRole('button', {name: 'Delete path mapping'})).toHaveLength(
        1
      );
    });

    it('shows an Automatic tag only on generated rows', () => {
      renderList({
        initialPathMappings: [
          {
            stackRoot: 'app/',
            sourceRoot: 'static/app/',
            branch: 'main',
            automaticallyGenerated: true,
          },
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'frontend'},
        ],
      });

      expect(screen.getAllByText('Automatic')).toHaveLength(1);
    });

    it('keeps delete on the summary when an existing row is expanded', async () => {
      renderList({initialPathMappings: MAPPINGS});

      const [firstExpand] = screen.getAllByRole('button', {name: 'Expand path mapping'});
      await userEvent.click(firstExpand!);

      expect(screen.getAllByRole('button', {name: 'Delete path mapping'})).toHaveLength(
        2
      );
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

  describe('empty-prefix and exact-duplicate warnings', () => {
    it('shows both-empty banner when both prefixes are blank', async () => {
      renderList();

      expect(
        await screen.findByText(
          'Both prefixes are empty, so Sentry will look for each file at the same path in your repo.'
        )
      ).toBeInTheDocument();
    });

    it('switches to stack-empty banner when only the repository prefix is filled', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /repository prefix/i}),
        'app/'
      );

      expect(
        screen.getByText(
          /The stack trace prefix is empty, so this mapping matches every file/
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/Both prefixes are empty/)).not.toBeInTheDocument();
    });

    it('switches to source-empty banner when only the stack prefix is filled', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src/'
      );

      expect(screen.getByText(/The repository prefix is empty/)).toBeInTheDocument();
      expect(screen.queryByText(/Both prefixes are empty/)).not.toBeInTheDocument();
    });

    it('hides all empty-prefix banners once both prefixes are filled', async () => {
      renderList();

      await userEvent.type(
        screen.getByRole('textbox', {name: /stack trace prefix/i}),
        'src/'
      );
      await userEvent.type(
        screen.getByRole('textbox', {name: /repository prefix/i}),
        'app/'
      );

      expect(screen.queryByText(/Both prefixes are empty/)).not.toBeInTheDocument();
      expect(screen.queryByText(/stack trace prefix is empty/)).not.toBeInTheDocument();
      expect(screen.queryByText(/repository prefix is empty/)).not.toBeInTheDocument();
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

      expect(
        screen.getByText(
          /Remove one since only one of them is required for path matching/
        )
      ).toBeInTheDocument();
    });

    it('shows warning icon and across-repos alert when an existing mapping on another repo has the same pair', async () => {
      renderList({
        pathMappings: [{stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'}],
        existingMappings: [
          {
            repoName: 'getsentry/relay',
            stackRoot: 'src/',
            sourceRoot: 'src/app/',
          } as RepositoryProjectPathConfig,
        ],
      });

      expect(screen.getByRole('img', {name: 'Warning'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));

      expect(screen.getByText(/getsentry\/relay/)).toBeInTheDocument();
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

    it('shows the exact-duplicate warning on a Code Owners row that duplicates another mapping', async () => {
      renderList({
        pathMappings: [
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main', hasCodeOwner: true},
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
        ],
      });

      // Exact duplicate takes priority: warning icon visible on the Code Owners row.
      expect(screen.getAllByRole('img', {name: 'Warning'})).toHaveLength(2);

      const [expandCodeOwner] = screen.getAllByRole('button', {
        name: 'Expand path mapping',
      });
      await userEvent.click(expandCodeOwner!);

      expect(
        screen.getByText(
          /Remove one since only one of them is required for path matching/
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/Code Owners/)).not.toBeInTheDocument();
    });

    it('shows the Code Owners alert on a Code Owners row with no duplicate', async () => {
      renderList({
        pathMappings: [
          {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main', hasCodeOwner: true},
        ],
      });

      // No duplicate — no warning icon on the collapsed row.
      expect(screen.queryByRole('img', {name: 'Warning'})).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Expand path mapping'}));

      expect(screen.getByRole('link', {name: 'Code Owners'})).toBeInTheDocument();
      expect(
        screen.queryByText(/Only one can be used for matching/)
      ).not.toBeInTheDocument();
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
