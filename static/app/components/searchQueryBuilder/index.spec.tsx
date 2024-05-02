import type {ComponentProps} from 'react';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {TagCollection} from 'sentry/types';
import {FieldKey, FieldKind} from 'sentry/utils/fields';

const MOCK_SUPPORTED_KEYS: TagCollection = {
  [FieldKey.AGE]: {key: FieldKey.AGE, name: 'Age', kind: FieldKind.FIELD},
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
  const defaultProps: ComponentProps<typeof SearchQueryBuilder> = {
    getTagValues: jest.fn(),
    initialQuery: '',
    supportedKeys: MOCK_SUPPORTED_KEYS,
    label: 'Query Builder',
  };

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

    it('can modify the value by clicking into it', async function () {
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
      // Should have placeholder text of previous value
      expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveAttribute(
        'placeholder',
        'firefox'
      );
      await userEvent.click(screen.getByRole('combobox', {name: 'Edit filter value'}));

      // Clicking the "Chrome option should update the value"
      await userEvent.click(screen.getByRole('option', {name: 'Chrome'}));
      expect(screen.getByRole('row', {name: 'browser.name:Chrome'})).toBeInTheDocument();
      expect(
        within(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        ).getByText('Chrome')
      ).toBeInTheDocument();
    });

    it('escapes values with spaces and reserved characters', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      await userEvent.click(
        screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
      );
      await userEvent.keyboard('some" value{enter}');
      // Value should be surrounded by quotes and escaped
      expect(
        screen.getByRole('row', {name: 'browser.name:"some\\" value"'})
      ).toBeInTheDocument();
      // Display text should be display the original value
      expect(
        within(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        ).getByText('some" value')
      ).toBeInTheDocument();
    });
  });

  describe('new search tokens', function () {
    it('can add a new token by clicking a key suggestion', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(screen.getByRole('option', {name: 'Browser Name'}));

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
      await userEvent.click(screen.getByRole('option', {name: 'Browser Name'}));

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
  });
});
