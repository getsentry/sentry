import type {ComponentProps} from 'react';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {
  type FilterKeySection,
  QueryInterfaceType,
} from 'sentry/components/searchQueryBuilder/types';
import {INTERFACE_TYPE_LOCALSTORAGE_KEY} from 'sentry/components/searchQueryBuilder/utils';
import {FieldKey, FieldKind} from 'sentry/utils/fields';
import localStorageWrapper from 'sentry/utils/localStorage';

const FITLER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: FieldKind.FIELD,
    label: 'Category 1',
    children: [
      {key: FieldKey.AGE, name: 'Age', kind: FieldKind.FIELD},
      {
        key: FieldKey.ASSIGNED,
        name: 'Assigned To',
        kind: FieldKind.FIELD,
        predefined: true,
        values: [
          {
            title: 'Suggested',
            type: 'header',
            icon: null,
            children: [{value: 'me'}, {value: 'unassigned'}],
          },
          {
            title: 'All',
            type: 'header',
            icon: null,
            children: [{value: 'person1@sentry.io'}, {value: 'person2@sentry.io'}],
          },
        ],
      },
      {
        key: FieldKey.BROWSER_NAME,
        name: 'Browser Name',
        kind: FieldKind.FIELD,
        predefined: true,
        values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
      },
      {
        key: FieldKey.IS,
        name: 'is',
        predefined: true,
        values: ['resolved', 'unresolved', 'ignored'],
      },
      {
        key: FieldKey.TIMES_SEEN,
        name: 'timesSeen',
        kind: FieldKind.FIELD,
      },
    ],
  },
  {
    value: FieldKind.TAG,
    label: 'Category 2',
    children: [
      {
        key: 'custom_tag_name',
        name: 'Custom_Tag_Name',
      },
    ],
  },
];

describe('SearchQueryBuilder', function () {
  beforeEach(() => {
    localStorageWrapper.clear();
  });

  afterEach(function () {
    jest.restoreAllMocks();
  });

  const defaultProps: ComponentProps<typeof SearchQueryBuilder> = {
    getTagValues: jest.fn(),
    initialQuery: '',
    filterKeySections: FITLER_KEY_SECTIONS,
    label: 'Query Builder',
  };

  describe('callbacks', function () {
    it('calls onChange, onBlur, and onSearch with the query string', async function () {
      const mockOnChange = jest.fn();
      const mockOnBlur = jest.fn();
      const mockOnSearch = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery=""
          onChange={mockOnChange}
          onBlur={mockOnBlur}
          onSearch={mockOnSearch}
        />
      );

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('foo{enter}');

      // Should call onChange and onSearch after enter
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('foo');
        expect(mockOnSearch).toHaveBeenCalledWith('foo');
      });

      await userEvent.click(document.body);

      // Clicking outside activates onBlur
      await waitFor(() => {
        expect(mockOnBlur).toHaveBeenCalledWith('foo');
      });
    });
  });

  describe('actions', function () {
    it('can clear the query', async function () {
      const mockOnChange = jest.fn();
      const mockOnSearch = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
          onSearch={mockOnSearch}
        />
      );
      userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
        expect(mockOnSearch).toHaveBeenCalledWith('');
      });

      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();

      expect(screen.getByRole('combobox')).toHaveFocus();
    });
  });

  describe('plain text interface', function () {
    beforeEach(() => {
      localStorageWrapper.setItem(
        INTERFACE_TYPE_LOCALSTORAGE_KEY,
        JSON.stringify(QueryInterfaceType.TEXT)
      );
    });

    it('can change the query by typing', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
          queryInterface={QueryInterfaceType.TEXT}
        />
      );

      expect(screen.getByRole('textbox')).toHaveValue('browser.name:firefox');
      await userEvent.type(screen.getByRole('textbox'), ' assigned:me');

      expect(screen.getByRole('textbox')).toHaveValue('browser.name:firefox assigned:me');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith('browser.name:firefox assigned:me');
      });
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
      await userEvent.click(screen.getByRole('option', {name: 'browser.name is not'}));

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

    it('can remove parens by clicking the delete button', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="(" />);

      expect(screen.getByRole('row', {name: '('})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete ('}));

      expect(screen.queryByRole('row', {name: '('})).not.toBeInTheDocument();
    });

    it('can remove boolean ops by clicking the delete button', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="OR" />);

      expect(screen.getByRole('row', {name: 'OR'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete OR'}));

      expect(screen.queryByRole('row', {name: 'OR'})).not.toBeInTheDocument();
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

      await userEvent.click(screen.getByRole('option', {name: 'Firefox'}));

      // New token should have a value
      expect(screen.getByRole('row', {name: 'browser.name:Firefox'})).toBeInTheDocument();
    });

    it('can add free text by typing', async function () {
      const mockOnSearch = jest.fn();
      render(<SearchQueryBuilder {...defaultProps} onSearch={mockOnSearch} />);

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.type(screen.getByRole('combobox'), 'some free text{enter}');
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('some free text');
      });
      // Should still have text in the input
      expect(screen.getByRole('combobox')).toHaveValue('some free text');
      // Should have closed the menu
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    });

    it('can add a filter after some free text', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('grid'));

      // XXX(malwilley): SearchQueryBuilderInput updates state in the render
      // function which causes an act warning despite using userEvent.click.
      // Cannot find a way to avoid this warning.
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      await userEvent.type(
        screen.getByRole('combobox'),
        'some free text brow{ArrowDown}{Enter}'
      );
      jest.restoreAllMocks();

      // Filter value should have focus
      expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
      await userEvent.keyboard('foo{enter}');

      // Should have a free text token "some free text"
      expect(
        await screen.findByRole('row', {name: /some free text/})
      ).toBeInTheDocument();

      // Should have a filter token "browser.name:foo"
      expect(screen.getByRole('row', {name: 'browser.name:foo'})).toBeInTheDocument();
    });

    it('can add parens by typing', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('(');

      expect(await screen.findByRole('row', {name: '('})).toBeInTheDocument();

      // Last input (the one after the paren) should have focus
      expect(screen.getAllByRole('combobox').at(-1)).toHaveFocus();
    });
  });

  describe('keyboard interactions', function () {
    beforeEach(() => {
      // jsdom does not support clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(''),
        },
      });
    });

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

    it('when focus is in a filter segment, backspace first focuses the filter then deletes it', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Focus into search (cursor be at end of the query)
      screen
        .getByRole('button', {name: 'Edit operator for filter: browser.name'})
        .focus();

      // Pressing backspace once should focus the token
      await userEvent.keyboard('{backspace}');
      expect(screen.queryByRole('row', {name: 'browser.name:firefox'})).toHaveFocus();

      // Pressing backspace again should remove the token
      await userEvent.keyboard('{backspace}');
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();
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

      // One more tab should go to the clear button
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Clear search query'})).toHaveFocus();

      // Another should exit component
      await userEvent.keyboard('{Tab}');
      expect(document.body).toHaveFocus();
    });

    it('converts pasted text into tokens', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="" />);

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.paste('browser.name:firefox');

      // Should have tokenized the pasted text
      expect(screen.getByRole('row', {name: 'browser.name:firefox'})).toBeInTheDocument();
      // Focus should be at the end of the pasted text
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)
      ).toHaveFocus();
    });

    it('can remove parens with the keyboard', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="(" />);

      expect(screen.getByRole('row', {name: '('})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('{backspace}{backspace}');

      expect(screen.queryByRole('row', {name: '('})).not.toBeInTheDocument();
    });

    it('can remove boolean ops with the keyboard', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="and" />);

      expect(screen.getByRole('row', {name: 'and'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('{backspace}{backspace}');

      expect(screen.queryByRole('row', {name: 'and'})).not.toBeInTheDocument();
    });

    it('exits filter value when pressing escape', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:Firefox" />
      );

      // Click into filter value (button to edit will no longer exist)
      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
      );
      expect(
        screen.queryByRole('button', {name: 'Edit value for filter: browser.name'})
      ).not.toBeInTheDocument();

      // Pressing escape will exit the filter value, so edit button will come back
      await userEvent.keyboard('{Escape}');
      expect(
        await screen.findByRole('button', {name: 'Edit value for filter: browser.name'})
      ).toBeInTheDocument();

      // Focus should now be to the right of the filter
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)
      ).toHaveFocus();
    });

    it('backspace does nothing when input is empty', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          onChange={mockOnChange}
          initialQuery="age:-24h"
        />
      );

      // Click into filter value (button to edit will no longer exist)
      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: age'})
      );

      await userEvent.keyboard('{Backspace}');

      // Input should still have focus, and no changes should have been made
      expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('can select all and delete with ctrl+a', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          onChange={mockOnChange}
          initialQuery="browser.name:firefox foo"
        />
      );

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('{Control>}a{/Control}');

      // Should have selected the entire query
      for (const token of screen.getAllByRole('row')) {
        expect(token).toHaveAttribute('aria-selected', 'true');
      }

      // Focus should be on the grid container
      expect(screen.getByRole('grid')).toHaveFocus();

      // Pressing delete should remove all selected tokens
      await userEvent.keyboard('{Backspace}');
      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('focus goes to first input after ctrl+a and arrow left', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('{Control>}a{/Control}');

      // Pressing arrow left should put focus in first text input
      await userEvent.keyboard('{ArrowLeft}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(0)
      ).toHaveFocus();
    });

    it('focus goes to last input after ctrl+a and arrow right', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('{Control>}a{/Control}');

      // Pressing arrow right should put focus in last text input
      await userEvent.keyboard('{ArrowRight}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)
      ).toHaveFocus();
    });

    it('can copy selection with ctrl-c', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox foo" />
      );

      await userEvent.click(screen.getByRole('grid'));
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('{Control>}c{/Control}');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'browser.name:firefox foo'
      );
    });

    it('can undo last action with ctrl-z', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Clear search query removes the token
      await userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();

      // Ctrl+Z adds it back
      await userEvent.keyboard('{Control>}z{/Control}');
      expect(
        await screen.findByRole('row', {name: 'browser.name:firefox'})
      ).toBeInTheDocument();
    });

    it('works with excess undo actions', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Remove the token
      await userEvent.click(
        screen.getByRole('button', {name: 'Remove filter: browser.name'})
      );
      await waitFor(() => {
        expect(
          screen.queryByRole('row', {name: 'browser.name:firefox'})
        ).not.toBeInTheDocument();
      });

      // Ctrl+Z adds it back
      await userEvent.keyboard('{Control>}z{/Control}');
      expect(
        await screen.findByRole('row', {name: 'browser.name:firefox'})
      ).toBeInTheDocument();
      // Extra Ctrl-Z should not do anything
      await userEvent.keyboard('{Control>}z{/Control}');

      // Remove token again
      await userEvent.click(
        screen.getByRole('button', {name: 'Remove filter: browser.name'})
      );
      await waitFor(() => {
        expect(
          screen.queryByRole('row', {name: 'browser.name:firefox'})
        ).not.toBeInTheDocument();
      });

      // Ctrl+Z adds it back again
      await userEvent.keyboard('{Control>}z{/Control}');
      expect(
        await screen.findByRole('row', {name: 'browser.name:firefox'})
      ).toBeInTheDocument();
    });
  });

  describe('token values', function () {
    it('supports grouped token value suggestions', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="assigned:me" />);
      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: assigned'})
      );

      const groups = within(screen.getByRole('listbox')).getAllByRole('group');

      // First group is selected option, second is "Suggested", third is "All"
      expect(groups).toHaveLength(3);
      expect(
        within(screen.getByRole('listbox')).getByText('Suggested')
      ).toBeInTheDocument();
      expect(within(screen.getByRole('listbox')).getByText('All')).toBeInTheDocument();

      // First group is the selected "me"
      expect(within(groups[0]).getByRole('option', {name: 'me'})).toBeInTheDocument();
      // Second group is the remaining option in the "Suggested" section
      expect(
        within(groups[1]).getByRole('option', {name: 'unassigned'})
      ).toBeInTheDocument();
      // Third group are the options under the "All" section
      expect(
        within(groups[2]).getByRole('option', {name: 'person1@sentry.io'})
      ).toBeInTheDocument();
      expect(
        within(groups[2]).getByRole('option', {name: 'person2@sentry.io'})
      ).toBeInTheDocument();
    });

    it('fetches tag values', async function () {
      const mockGetTagValues = jest.fn().mockResolvedValue(['tag_value_one']);
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="custom_tag_name:"
          getTagValues={mockGetTagValues}
        />
      );

      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: custom_tag_name'})
      );
      await screen.findByRole('option', {name: 'tag_value_one'});
      await userEvent.click(screen.getByRole('option', {name: 'tag_value_one'}));

      expect(
        await screen.findByRole('row', {name: 'custom_tag_name:tag_value_one'})
      ).toBeInTheDocument();
    });
  });

  describe('filter types', function () {
    describe('is', function () {
      it('can modify the value by clicking into it', async function () {
        // `is` only accepts single values
        render(<SearchQueryBuilder {...defaultProps} initialQuery="is:unresolved" />);

        // Should display as "unresolved" to start
        expect(
          within(
            screen.getByRole('button', {name: 'Edit value for filter: is'})
          ).getByText('unresolved')
        ).toBeInTheDocument();

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: is'})
        );
        // Should have placeholder text of previous value
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveAttribute(
          'placeholder',
          'unresolved'
        );

        // Clicking the "resolved" option should update the value
        await userEvent.click(await screen.findByRole('option', {name: 'resolved'}));
        expect(screen.getByRole('row', {name: 'is:resolved'})).toBeInTheDocument();
        expect(
          within(
            screen.getByRole('button', {name: 'Edit value for filter: is'})
          ).getByText('resolved')
        ).toBeInTheDocument();
      });
    });

    describe('has', function () {
      it('display has and does not have as options', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="has:key"
          />
        );

        expect(
          within(
            screen.getByRole('button', {name: 'Edit value for filter: has'})
          ).getByText('key')
        ).toBeInTheDocument();

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: has'})
        );
        await userEvent.click(await screen.findByRole('option', {name: 'does not have'}));
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('!has:key');
        });
        expect(
          within(
            screen.getByRole('button', {name: 'Edit operator for filter: has'})
          ).getByText('does not have')
        ).toBeInTheDocument();
      });
    });

    describe('string', function () {
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
        await userEvent.click(screen.getByRole('option', {name: 'browser.name is not'}));

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

      it('can modify the value by clicking into it (multi-select)', async function () {
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
        // Should start with previous values and an appended ',' for the next value
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            'firefox,'
          );
        });

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

      it('collapses many selected options', function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            initialQuery="browser.name:[one,two,three,four]"
          />
        );

        const valueButton = screen.getByRole('button', {
          name: 'Edit value for filter: browser.name',
        });
        expect(within(valueButton).getByText('one')).toBeInTheDocument();
        expect(within(valueButton).getByText('two')).toBeInTheDocument();
        expect(within(valueButton).getByText('three')).toBeInTheDocument();
        expect(within(valueButton).getByText('+1')).toBeInTheDocument();
        expect(within(valueButton).queryByText('four')).not.toBeInTheDocument();
        expect(within(valueButton).getAllByText('or')).toHaveLength(2);
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
          await screen.findByRole('row', {name: 'assigned:"some\\" value"'})
        ).toBeInTheDocument();
        // Display text should be display the original value
        expect(
          within(
            screen.getByRole('button', {name: 'Edit value for filter: assigned'})
          ).getByText('some" value')
        ).toBeInTheDocument();
      });

      it('can replace a value with a new one', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:[1,c,3]" />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            '1,c,3,'
          );
        });

        // Arrow left three times to put cursor inside "c" value
        await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');

        // When on c value, should show options matching "c"
        const chromeOption = await screen.findByRole('option', {name: 'Chrome'});

        // Clicking the "Chrome option should replace "c" with "Chrome" and commit chagnes
        await userEvent.click(chromeOption);
        expect(
          await screen.findByRole('row', {name: 'browser.name:[1,Chrome,3]'})
        ).toBeInTheDocument();
      });

      it('can enter a custom value', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="browser.name:" />);

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );
        await userEvent.keyboard('foo,bar{enter}');
        expect(
          await screen.findByRole('row', {name: 'browser.name:[foo,bar]'})
        ).toBeInTheDocument();
      });
    });

    describe('numeric', function () {
      it('new numeric filters start with a value', async function () {
        render(<SearchQueryBuilder {...defaultProps} />);
        await userEvent.click(screen.getByRole('grid'));
        await userEvent.keyboard('time{ArrowDown}{Enter}');

        // Should start with the > operator and a value of 100
        expect(
          await screen.findByRole('row', {name: 'timesSeen:>100'})
        ).toBeInTheDocument();
      });

      it('does not allow invalid values', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="timesSeen:>100" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: timesSeen'})
        );
        await userEvent.keyboard('a{Enter}');

        // Should have the same value because "a" is not a numeric value
        expect(screen.getByRole('row', {name: 'timesSeen:>100'})).toBeInTheDocument();

        await userEvent.keyboard('{Backspace}7k{Enter}');

        // Should accept "7k" as a valid value
        expect(
          await screen.findByRole('row', {name: 'timesSeen:>7k'})
        ).toBeInTheDocument();
      });

      it('can change the operator', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="timesSeen:>100k" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: timesSeen'})
        );
        await userEvent.click(screen.getByRole('option', {name: 'timesSeen <='}));

        expect(
          await screen.findByRole('row', {name: 'timesSeen:<=100k'})
        ).toBeInTheDocument();
      });
    });

    describe('date', function () {
      // Transpile the lazy-loaded datepicker up front so tests don't flake
      beforeAll(async function () {
        await import('sentry/components/calendar/datePicker');
      });

      it('new date filters start with a value', async function () {
        render(<SearchQueryBuilder {...defaultProps} />);
        await userEvent.click(screen.getByRole('grid'));
        await userEvent.keyboard('age{ArrowDown}{Enter}');

        // Should start with a relative date value
        expect(await screen.findByRole('row', {name: 'age:-24h'})).toBeInTheDocument();
      });

      it('does not allow invalid values', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        await userEvent.keyboard('a{Enter}');

        // Should have the same value because "a" is not a date value
        expect(screen.getByRole('row', {name: 'age:-24h'})).toBeInTheDocument();
      });

      it('shows default date suggestions', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        await userEvent.click(await screen.findByRole('option', {name: '1 hour ago'}));
        expect(screen.getByRole('row', {name: 'age:-1h'})).toBeInTheDocument();
      });

      it('shows date suggestions when typing', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );

        // Typing "7" should show suggestions for 7 minutes, hours, days, and weeks
        await userEvent.keyboard('7');
        await screen.findByRole('option', {name: '7 minutes ago'});
        expect(screen.getByRole('option', {name: '7 hours ago'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '7 days ago'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '7 weeks ago'})).toBeInTheDocument();

        await userEvent.click(screen.getByRole('option', {name: '7 weeks ago'}));
        expect(screen.getByRole('row', {name: 'age:-7w'})).toBeInTheDocument();
      });

      it('can search before a relative date', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: age'})
        );
        await userEvent.click(await screen.findByRole('option', {name: 'age is before'}));

        // Should flip from "-" to "+"
        expect(await screen.findByRole('row', {name: 'age:+24h'})).toBeInTheDocument();
      });

      it('switches to an absolute date when choosing operator with equality', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: age'})
        );
        await userEvent.click(
          await screen.findByRole('option', {name: 'age is on or after'})
        );

        // Changes operator and fills in the current date (ISO format)
        expect(
          await screen.findByRole('row', {name: 'age:>=2017-10-17T02:41:20.000Z'})
        ).toBeInTheDocument();
      });

      it('can switch from after an absolute date to a relative one', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="foo age:>=2017-10-17"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        // Go back to relative date suggestions
        await userEvent.click(await screen.findByRole('button', {name: 'Back'}));
        await userEvent.click(await screen.findByRole('option', {name: '1 hour ago'}));

        // Because relative dates only work with ":", should change the operator to "is after"
        expect(
          within(
            screen.getByRole('button', {name: 'Edit operator for filter: age'})
          ).getByText('is after')
        ).toBeInTheDocument();

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('foo age:-1h');
        });
      });

      it('can switch from before an absolute date to a relative one', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="foo age:<=2017-10-17"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        // Go back to relative date suggestions
        await userEvent.click(await screen.findByRole('button', {name: 'Back'}));
        await userEvent.click(await screen.findByRole('option', {name: '1 hour ago'}));

        // Because relative dates only work with ":", should change the operator to "is before"
        expect(
          within(
            screen.getByRole('button', {name: 'Edit operator for filter: age'})
          ).getByText('is before')
        ).toBeInTheDocument();

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('foo age:+1h');
        });
      });

      it('can set an absolute date', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="age:-24h"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        await userEvent.click(await screen.findByRole('option', {name: 'Absolute date'}));
        const dateInput = await screen.findByTestId('date-picker');
        await userEvent.type(dateInput, '2017-10-17');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('age:>2017-10-17');
        });
      });

      it('can set an absolute date with time (UTC)', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="age:>2017-10-17"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        await userEvent.click(
          await screen.findByRole('checkbox', {name: 'Include time'})
        );

        await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('age:>2017-10-17T00:00:00Z');
        });
      });

      it('can set an absolute date with time (local)', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="age:>2017-10-17"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );
        await userEvent.click(
          await screen.findByRole('checkbox', {name: 'Include time'})
        );
        await userEvent.click(await screen.findByRole('checkbox', {name: 'UTC'}));

        await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith('age:>2017-10-17T00:00:00+00:00');
        });
      });

      it('displays absolute date value correctly (just date)', function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:>=2017-10-17" />);

        expect(screen.getByText('is on or after')).toBeInTheDocument();
        expect(screen.getByText('Oct 17')).toBeInTheDocument();
      });

      it('displays absolute date value correctly (with local time)', function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            initialQuery="age:>=2017-10-17T14:00:00-00:00"
          />
        );

        expect(screen.getByText('is on or after')).toBeInTheDocument();
        expect(screen.getByText('Oct 17, 2:00 PM')).toBeInTheDocument();
      });

      it('displays absolute date value correctly (with UTC time)', function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            initialQuery="age:>=2017-10-17T14:00:00Z"
          />
        );

        expect(screen.getByText('is on or after')).toBeInTheDocument();
        expect(screen.getByText('Oct 17, 2:00 PM UTC')).toBeInTheDocument();
      });
    });
  });
});
