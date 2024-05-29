import type {ComponentProps} from 'react';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {TagCollection} from 'sentry/types/group';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

const MOCK_SUPPORTED_KEYS: TagCollection = {
  [FieldKey.AGE]: {
    key: FieldKey.AGE,
    name: 'Age',
    kind: FieldKind.FIELD,
    predefined: true,
  },
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['me', 'unassigned', 'person@sentry.io'],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  },
  custom_tag_name: {key: 'custom_tag_name', name: 'Custom_Tag_Name', kind: FieldKind.TAG},
};

describe('SearchQueryBuilder', function () {
  afterEach(function () {
    jest.restoreAllMocks();
  });

  const defaultProps: ComponentProps<typeof SearchQueryBuilder> = {
    getTagValues: jest.fn(),
    initialQuery: '',
    supportedKeys: MOCK_SUPPORTED_KEYS,
    label: 'Query Builder',
  };

  describe('actions', function () {
    it('can clear the query', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
        />
      );
      userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
      });

      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();
    });
  });

  describe('mouse interactions', function () {
    it('can remove a token by clicking the delete button', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox custom_tag_name:123"
        />
      );

      expect(screen.getByRole('row', {name: 'browser.name:firefox'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'custom_tag_name:123'})).toBeInTheDocument();

      await userEvent.click(
        within(screen.getByRole('row', {name: 'browser.name:firefox'})).getByRole(
          'button',
          {name: 'Remove filter: browser.name'}
        )
      );

      // Browser name token should be removed
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();

      // Custom tag token should still be present
      expect(screen.getByRole('row', {name: 'custom_tag_name:123'})).toBeInTheDocument();
    });

    it('can modify the operator by clicking into it', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Should display as "is" to start
      expect(
        within(
          screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
        ).getByText('is')
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'is not'}));

      // Token should be modified to be negated
      expect(
        screen.getByRole('row', {name: '!browser.name:firefox'})
      ).toBeInTheDocument();

      // Should now have "is not" label
      expect(
        within(
          screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
        ).getByText('is not')
      ).toBeInTheDocument();
    });

    it('can modify operator for filter with multiple values', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:[firefox,chrome]"
        />
      );

      // Should display as "is" to start
      expect(
        within(
          screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
        ).getByText('is')
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'is not'}));

      // Token should be modified to be negated
      expect(
        screen.getByRole('row', {name: '!browser.name:[firefox,chrome]'})
      ).toBeInTheDocument();

      // Should now have "is not" label
      expect(
        within(
          screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
        ).getByText('is not')
      ).toBeInTheDocument();
    });

    it('can modify the value by clicking into it (single-select)', async function () {
      // `age` is a duration filter which only accepts single values
      render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-1d" />);

      // Should display as "-1d" to start
      expect(
        within(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        ).getByText('-1d')
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: age'})
      );
      // Should have placeholder text of previous value
      expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveAttribute(
        'placeholder',
        '-1d'
      );
      await userEvent.click(screen.getByRole('combobox', {name: 'Edit filter value'}));

      // Clicking the "+14d" option should update the value
      await userEvent.click(screen.getByRole('option', {name: '+14d'}));
      expect(screen.getByRole('row', {name: 'age:+14d'})).toBeInTheDocument();
      expect(
        within(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        ).getByText('+14d')
      ).toBeInTheDocument();
    });

    it('can modify the value by clicking into it (multi-select)', async function () {
      // `browser.name` is a string filter which accepts multiple values
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Should display as "firefox" to start
      expect(
        within(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        ).getByText('firefox')
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
      );
      // Previous value should be rendered before the input
      expect(
        within(screen.getByRole('row', {name: 'browser.name:firefox'})).getByText(
          'firefox,'
        )
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('combobox', {name: 'Edit filter value'}));

      // Clicking the "Chrome option should add it to the list and commit changes
      await userEvent.click(screen.getByRole('option', {name: 'Chrome'}));
      expect(
        screen.getByRole('row', {name: 'browser.name:[firefox,Chrome]'})
      ).toBeInTheDocument();
      const valueButton = screen.getByRole('button', {
        name: 'Edit value for filter: browser.name',
      });
      expect(within(valueButton).getByText('firefox')).toBeInTheDocument();
      expect(within(valueButton).getByText('or')).toBeInTheDocument();
      expect(within(valueButton).getByText('Chrome')).toBeInTheDocument();
    });

    it('escapes values with spaces and reserved characters', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="" />);
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'assigned:some" value{enter}'
      );
      // Value should be surrounded by quotes and escaped
      expect(
        screen.getByRole('row', {name: 'assigned:"some\\" value"'})
      ).toBeInTheDocument();
      // Display text should be display the original value
      expect(
        within(
          screen.getByRole('button', {name: 'Edit value for filter: assigned'})
        ).getByText('some" value')
      ).toBeInTheDocument();
    });
  });

  describe('new search tokens', function () {
    it('can add an unsupported filter key and value', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'a:b{enter}'
      );

      expect(screen.getByRole('row', {name: 'a:b'})).toBeInTheDocument();
    });

    it('breaks keys into sections', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));

      const menu = screen.getByRole('listbox');
      const groups = within(menu).getAllByRole('group');
      expect(groups).toHaveLength(2);

      // First group (Field) should have age, assigned, browser.name
      const group1 = groups[0];
      expect(within(group1).getByRole('option', {name: 'age'})).toBeInTheDocument();
      expect(within(group1).getByRole('option', {name: 'assigned'})).toBeInTheDocument();
      expect(
        within(group1).getByRole('option', {name: 'browser.name'})
      ).toBeInTheDocument();

      // Second group (Tag) should have custom_tag_name
      const group2 = groups[1];
      expect(
        within(group2).getByRole('option', {name: 'custom_tag_name'})
      ).toBeInTheDocument();
    });

    it('can add a new token by clicking a key suggestion', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(screen.getByRole('option', {name: 'browser.name'}));

      // New token should be added with the correct key
      expect(screen.getByRole('row', {name: 'browser.name:'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('combobox', {name: 'Edit filter value'}));
      await userEvent.click(screen.getByRole('option', {name: 'Firefox'}));

      // New token should have a value
      expect(screen.getByRole('row', {name: 'browser.name:Firefox'})).toBeInTheDocument();
    });

    it('can add free text by typing', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.type(screen.getByRole('combobox'), 'some free text{enter}');
      expect(screen.getByRole('combobox')).toHaveValue('some free text');
    });

    it('can add a filter after some free text', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.type(
        screen.getByRole('combobox'),
        'some free text brow{ArrowDown}'
      );

      // XXX(malwilley): SearchQueryBuilderInput updates state in the render
      // function which causes an act warning despite using userEvent.click.
      // Cannot find a way to avoid this warning.
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      await userEvent.click(screen.getByRole('option', {name: 'browser.name'}));
      jest.restoreAllMocks();

      // Should have a free text token "some free text"
      expect(screen.getByRole('row', {name: 'some free text'})).toBeInTheDocument();

      // Should have a filter token with key "browser.name"
      expect(screen.getByRole('row', {name: 'browser.name:'})).toBeInTheDocument();

      // Filter value should have focus
      expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
    });
  });

  describe('keyboard interactions', function () {
    it('can remove a previous token by pressing backspace', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Focus into search (cursor be at end of the query)
      await userEvent.click(screen.getByRole('grid'));

      // Pressing backspace once should focus the previous token
      await userEvent.keyboard('{backspace}');
      expect(screen.queryByRole('row', {name: 'browser.name:firefox'})).toHaveFocus();

      // Pressing backspace again should remove the token
      await userEvent.keyboard('{backspace}');
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();
    });

    it('can remove a subsequent token by pressing delete', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Put focus into the first input (before the token)
      await userEvent.click(
        screen.getAllByRole('combobox', {name: 'Add a search term'})[0]
      );

      // Pressing delete once should focus the previous token
      await userEvent.keyboard('{delete}');
      expect(screen.queryByRole('row', {name: 'browser.name:firefox'})).toHaveFocus();

      // Pressing delete again should remove the token
      await userEvent.keyboard('{delete}');
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();
    });

    it('can navigate between tokens with arrow keys', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox abc assigned:me"
        />
      );

      await userEvent.click(screen.getByRole('grid'));

      // Focus should be in the last text input
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)
      ).toHaveFocus();

      // Left once focuses the assigned remove button
      await userEvent.keyboard('{arrowleft}');
      expect(screen.getByRole('button', {name: 'Remove filter: assigned'})).toHaveFocus();

      // Left again focuses the assigned filter value
      await userEvent.keyboard('{arrowleft}');
      expect(
        screen.getByRole('button', {name: 'Edit value for filter: assigned'})
      ).toHaveFocus();

      // Left again focuses the assigned operator
      await userEvent.keyboard('{arrowleft}');
      expect(
        screen.getByRole('button', {name: 'Edit operator for filter: assigned'})
      ).toHaveFocus();

      // Left again focuses the assigned key
      await userEvent.keyboard('{arrowleft}');
      expect(
        screen.getByRole('button', {name: 'Edit filter key: assigned'})
      ).toHaveFocus();

      // Left again goes to the next text input between tokens
      await userEvent.keyboard('{arrowleft}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-2)
      ).toHaveFocus();

      // 4 more lefts go through the input text "abc" and to the next token
      await userEvent.keyboard('{arrowleft}{arrowleft}{arrowleft}{arrowleft}');
      expect(
        screen.getByRole('button', {name: 'Remove filter: browser.name'})
      ).toHaveFocus();

      // 1 right goes back to the text input
      await userEvent.keyboard('{arrowright}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-2)
      ).toHaveFocus();
    });

    it('has a single tab stop', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      expect(document.body).toHaveFocus();

      // Tabbing in should focus the last input
      await userEvent.keyboard('{Tab}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)
      ).toHaveFocus();

      // Shift-tabbing should exit the component
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(document.body).toHaveFocus();
    });
  });
});
