import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';

import {PathMappingList} from './pathMappingList';
import type {PathMappingValue} from './type';

const MAPPINGS: PathMappingValue[] = [
  {id: '1', stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
  {id: '2', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'frontend'},
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
  allowEmpty,
}: {
  allowEmpty?: boolean;
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
          allowEmpty={allowEmpty}
          defaultBranch={defaultBranch}
          providerKey={providerKey}
          existingMappings={existingMappings}
        />
      </form.AppForm>
    );
  }
  return render(<Wrapper />);
}

const stackInputs = () => screen.getAllByRole('textbox', {name: /stack trace prefix/i});

// Matches the element whose full text is `text`, even when it's split across a
// highlighted span, and not its ancestors.
const fullText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text &&
  ![...element.children].some(child => child.textContent === text);

describe('PathMappingList', () => {
  describe('empty', () => {
    it('starts with a single editable row', () => {
      renderList();

      expect(screen.getByText('Code mappings')).toBeInTheDocument();
      expect(stackInputs()).toHaveLength(1);
      expect(
        screen.getByRole('textbox', {name: /repository prefix/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Delete path mapping'})).toBeEnabled();
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
  });

  describe('with existing mappings', () => {
    it('renders every mapping as an editable row', () => {
      renderList({initialPathMappings: MAPPINGS});

      expect(stackInputs()).toHaveLength(2);
      expect(screen.getAllByRole('textbox', {name: /repository prefix/i})).toHaveLength(
        2
      );
      expect(screen.getAllByRole('textbox', {name: /branch/i})).toHaveLength(2);
      // Each prefix shows in its input and in the row's example path.
      expect(screen.getAllByText('static/app/')).toHaveLength(2);
      expect(screen.getAllByRole('textbox', {name: /branch/i})[1]).toHaveValue(
        'frontend'
      );
    });

    it('shows the example with each prefix leading its path', () => {
      renderList({initialPathMappings: [MAPPINGS[0]!]});

      expect(screen.getByText('e.g')).toBeInTheDocument();
      // Each side reads as one path: the prefix, then the file.
      expect(screen.getByText(fullText('app/views/index.tsx'))).toBeInTheDocument();
      expect(
        screen.getByText(fullText('static/app/views/index.tsx'))
      ).toBeInTheDocument();
      // The prefixes appear both in the inputs and in the example.
      expect(screen.getAllByText('app/')).toHaveLength(2);
      expect(screen.getAllByText('static/app/')).toHaveLength(2);
    });

    it('shows just the file for an empty prefix', () => {
      renderList({
        initialPathMappings: [{stackRoot: '', sourceRoot: 'src/', branch: 'main'}],
      });

      expect(screen.getByText(fullText('views/index.tsx'))).toBeInTheDocument();
      expect(screen.getByText(fullText('src/views/index.tsx'))).toBeInTheDocument();
    });

    it('adds a new mapping when "Add mapping" is clicked', async () => {
      renderList({initialPathMappings: MAPPINGS});

      await userEvent.click(screen.getByRole('button', {name: 'Add mapping'}));

      expect(stackInputs()).toHaveLength(3);
      expect(stackInputs()[2]).toHaveValue('');
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

    it('removes a mapping', async () => {
      renderList({initialPathMappings: MAPPINGS});

      const [firstDelete] = screen.getAllByRole('button', {name: 'Delete path mapping'});
      await userEvent.click(firstDelete!);

      expect(stackInputs()).toHaveLength(1);
      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('frontend');
      expect(screen.queryByText('static/app/')).not.toBeInTheDocument();
    });

    it('keeps the remaining row editable after deleting a row above it', async () => {
      renderList({initialPathMappings: MAPPINGS});

      const [firstDelete] = screen.getAllByRole('button', {name: 'Delete path mapping'});
      await userEvent.click(firstDelete!);
      await userEvent.click(screen.getByRole('textbox', {name: /branch/i}));
      await userEvent.tab();

      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('frontend');
    });

    it('falls back to a fresh row when the last mapping is deleted', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!]});

      await userEvent.click(screen.getByRole('button', {name: 'Delete path mapping'}));

      expect(stackInputs()).toHaveLength(1);
      expect(screen.queryByText('static/app/')).not.toBeInTheDocument();
    });
  });

  describe('duplicate mappings', () => {
    it('blocks adding another path until the duplicate is resolved', () => {
      const duplicates: PathMappingValue[] = [
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
        {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      ];
      renderList({initialPathMappings: duplicates});

      expect(screen.getByRole('button', {name: 'Add mapping'})).toHaveAttribute(
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

      expect(screen.getByRole('button', {name: 'Add mapping'})).toHaveAttribute(
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

      expect(screen.getByRole('button', {name: 'Add mapping'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('add mapping', () => {
    it('blocks adding a third empty row as a duplicate of the second', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!]});

      await userEvent.click(screen.getByRole('button', {name: 'Add mapping'}));
      expect(stackInputs()).toHaveLength(2);

      await userEvent.click(screen.getByRole('button', {name: 'Add mapping'}));
      expect(stackInputs()).toHaveLength(3);

      expect(screen.getByRole('button', {name: 'Add mapping'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('allowEmpty', () => {
    it('adds a row from the empty state then deletes back to empty', async () => {
      renderList({pathMappings: [], allowEmpty: true});

      expect(screen.getByText('No paths configured')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Add path'}));
      expect(
        screen.getByRole('textbox', {name: /stack trace prefix/i})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Delete path mapping'}));
      expect(screen.getByText('No paths configured')).toBeInTheDocument();
    });
  });

  describe('defaultBranch', () => {
    it('seeds the initial row with the provided default branch', () => {
      renderList({defaultBranch: 'master'});

      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('master');
    });

    it('seeds new rows added via "Add mapping" with the provided default branch', async () => {
      renderList({initialPathMappings: [MAPPINGS[0]!], defaultBranch: 'master'});

      await userEvent.click(screen.getByRole('button', {name: 'Add mapping'}));

      expect(screen.getAllByRole('textbox', {name: /branch/i})[1]).toHaveValue('master');
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
      await userEvent.tab();

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
      // Combobox commits the typed value on blur, not on each keystroke.
      await userEvent.tab();

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
      await userEvent.tab();

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

      expect(
        screen.queryByText(
          /Remove one since only one of them is required for path matching/
        )
      ).not.toBeInTheDocument();
    });

    it('shows the in-form duplicate alert only on the later copy', () => {
      renderList({
        pathMappings: [
          {id: '1', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
          {id: '2', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
          {id: '3', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
        ],
      });

      // The first row is the original; each later copy is flagged.
      expect(
        screen.getAllByText(
          /Remove one since only one of them is required for path matching/
        )
      ).toHaveLength(2);
    });

    it('shows the across-repos alert when an existing mapping on another repo has the same pair', () => {
      renderList({
        pathMappings: [
          {id: '1', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
        ],
        existingMappings: [
          {
            repoName: 'getsentry/relay',
            stackRoot: 'src/',
            sourceRoot: 'src/app/',
          } as RepositoryProjectPathConfig,
        ],
      });

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
      expect(screen.getByRole('button', {name: 'Add mapping'})).not.toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('keeps the Code Owners alert on the original and flags the later copy', () => {
      renderList({
        pathMappings: [
          {
            id: '1',
            stackRoot: 'src/',
            sourceRoot: 'src/app/',
            branch: 'main',
            hasCodeOwner: true,
          },
          {id: '2', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
        ],
      });

      expect(screen.getByRole('link', {name: 'Code Owners'})).toBeInTheDocument();
      expect(
        screen.getAllByText(
          /Remove one since only one of them is required for path matching/
        )
      ).toHaveLength(1);
    });

    it('flags a Code Owners row that duplicates an earlier mapping', () => {
      renderList({
        pathMappings: [
          {id: '1', stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'main'},
          {
            id: '2',
            stackRoot: 'src/',
            sourceRoot: 'src/app/',
            branch: 'main',
            hasCodeOwner: true,
          },
        ],
      });

      // The duplicate warning takes priority over the Code Owners message.
      expect(
        screen.getAllByText(
          /Remove one since only one of them is required for path matching/
        )
      ).toHaveLength(1);
      expect(screen.queryByRole('link', {name: 'Code Owners'})).not.toBeInTheDocument();
    });

    it('shows the Code Owners alert on a Code Owners row with no duplicate', () => {
      renderList({
        pathMappings: [
          {
            id: '1',
            stackRoot: 'src/',
            sourceRoot: 'src/app/',
            branch: 'main',
            hasCodeOwner: true,
          },
        ],
      });

      expect(screen.getByRole('link', {name: 'Code Owners'})).toBeInTheDocument();
      expect(
        screen.queryByText(/Only one can be used for matching/)
      ).not.toBeInTheDocument();
    });

    it('explains the disabled delete with a link to Code Owners', async () => {
      renderList({
        pathMappings: [
          {
            id: '1',
            stackRoot: 'src/',
            sourceRoot: 'src/app/',
            branch: 'main',
            hasCodeOwner: true,
          },
        ],
      });

      const deleteButton = screen.getByRole('button', {name: 'Delete path mapping'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
      await userEvent.hover(deleteButton);
      expect(await screen.findAllByRole('link', {name: 'Code Owners'})).toHaveLength(2);
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

      // Normalized value 'src/' committed on blur and shown as the selected option.
      expect(screen.getAllByText('src/')).not.toHaveLength(0);
    });

    it('converts invalid branch characters to dashes', async () => {
      renderList();

      await userEvent.clear(screen.getByRole('textbox', {name: /branch/i}));
      await userEvent.type(screen.getByRole('textbox', {name: /branch/i}), 'my branch');

      expect(screen.getByRole('textbox', {name: /branch/i})).toHaveValue('my-branch');
    });
  });
});
