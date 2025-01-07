import type {ComponentProps} from 'react';
import {destroyAnnouncer} from '@react-aria/live-announcer';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import {
  type FieldDefinitionGetter,
  type FilterKeySection,
  QueryInterfaceType,
} from 'sentry/components/searchQueryBuilder/types';
import {INTERFACE_TYPE_LOCALSTORAGE_KEY} from 'sentry/components/searchQueryBuilder/utils';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import {
  FieldKey,
  FieldKind,
  FieldValueType,
  getFieldDefinition,
} from 'sentry/utils/fields';
import localStorageWrapper from 'sentry/utils/localStorage';

const FILTER_KEYS: TagCollection = {
  [FieldKey.AGE]: {key: FieldKey.AGE, name: 'Age', kind: FieldKind.FIELD},
  [FieldKey.ASSIGNED]: {
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
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  },
  [FieldKey.IS]: {
    key: FieldKey.IS,
    name: 'is',
    predefined: true,
    values: ['resolved', 'unresolved', 'ignored'],
  },
  [FieldKey.TIMES_SEEN]: {
    key: FieldKey.TIMES_SEEN,
    name: 'timesSeen',
    kind: FieldKind.FIELD,
  },
  custom_tag_name: {
    key: 'custom_tag_name',
    name: 'Custom_Tag_Name',
  },
  uncategorized_tag: {
    key: 'uncategorized_tag',
    name: 'uncategorized_tag',
  },
};

const FITLER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: FieldKind.FIELD,
    label: 'Category 1',
    children: [
      FieldKey.AGE,
      FieldKey.ASSIGNED,
      FieldKey.BROWSER_NAME,
      FieldKey.IS,
      FieldKey.TIMES_SEEN,
    ],
  },
  {
    value: FieldKind.TAG,
    label: 'Category 2',
    children: ['custom_tag_name'],
  },
];

function getLastInput() {
  const input = screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1);

  expect(input).toBeInTheDocument();

  return input!;
}

describe('SearchQueryBuilder', function () {
  beforeEach(() => {
    // `useDimensions` is used to hide things when the component is too small, so we need to mock a large width
    Object.defineProperty(Element.prototype, 'clientWidth', {value: 1000});

    // Combobox announcements will pollute the test output if we don't clear them
    destroyAnnouncer();

    MockApiClient.clearMockResponses();
  });

  afterEach(function () {
    jest.restoreAllMocks();
  });

  const defaultProps: ComponentProps<typeof SearchQueryBuilder> = {
    getTagValues: jest.fn(() => Promise.resolve([])),
    initialQuery: '',
    filterKeySections: FITLER_KEY_SECTIONS,
    filterKeys: FILTER_KEYS,
    label: 'Query Builder',
    searchSource: '',
  };

  it('displays a placeholder when empty', async function () {
    render(<SearchQueryBuilder {...defaultProps} placeholder="foo" />);
    expect(await screen.findByPlaceholderText('foo')).toBeInTheDocument();
  });

  describe('callbacks', function () {
    it('calls onChange, onBlur, and onSearch with the query string', async function () {
      const mockOnChange = jest.fn();
      const mockOnBlur = jest.fn();
      const mockOnSearch = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="a"
          onChange={mockOnChange}
          onBlur={mockOnBlur}
          onSearch={mockOnSearch}
        />
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('b{enter}');

      const expectedQueryState = expect.objectContaining({
        parsedQuery: expect.arrayContaining([expect.any(Object)]),
        queryIsValid: true,
      });

      // Should call onChange and onSearch after enter
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledTimes(1);
      });
      expect(mockOnChange).toHaveBeenCalledWith('ab', expectedQueryState);
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).toHaveBeenCalledWith('ab', expectedQueryState);

      await userEvent.click(document.body);

      // Clicking outside activates onBlur
      await waitFor(() => {
        expect(mockOnBlur).toHaveBeenCalledTimes(1);
      });
      expect(mockOnBlur).toHaveBeenCalledWith('ab', expectedQueryState);
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
      await userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('', expect.anything());
      });
      expect(mockOnSearch).toHaveBeenCalledWith('', expect.anything());

      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();

      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('is hidden at small sizes', async function () {
      Object.defineProperty(Element.prototype, 'clientWidth', {value: 100});
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
        />
      );
      // Must await something to prevent act warnings
      await act(tick);

      expect(
        screen.queryByRole('button', {name: 'Clear search query'})
      ).not.toBeInTheDocument();
    });

    it('is hidden if the prop is specified and text is empty', async function () {
      const mockOnChange = jest.fn();
      render(<SearchQueryBuilder {...defaultProps} onChange={mockOnChange} />);
      await screen.findByRole('combobox', {name: 'Add a search term'});

      expect(
        screen.queryByRole('button', {name: 'Clear search query'})
      ).not.toBeInTheDocument();
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'foo a:b{enter}'
      );

      await waitFor(() => expect(mockOnChange).toHaveBeenCalled());

      expect(
        screen.getByRole('button', {name: 'Clear search query'})
      ).toBeInTheDocument();
    });
  });

  describe('disabled', function () {
    it('disables all interactable elements', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
          disabled
        />
      );
      // Must await something to prevent act warnings
      await act(tick);

      expect(getLastInput()).toBeDisabled();
      expect(
        screen.queryByRole('button', {name: 'Clear search query'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Remove filter: browser.name'})
      ).toBeDisabled();
      expect(
        screen.getByRole('button', {name: 'Edit operator for filter: browser.name'})
      ).toBeDisabled();
      expect(
        screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
      ).toBeDisabled();
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
        expect(mockOnChange).toHaveBeenLastCalledWith(
          'browser.name:firefox assigned:me',
          expect.anything()
        );
      });
    });
  });

  describe('filter key menu', function () {
    it('breaks keys into sections', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));

      // Should show tab button for each section
      expect(await screen.findByRole('button', {name: 'All'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Category 1'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Category 2'})).toBeInTheDocument();

      const menu = screen.getByRole('listbox');
      const groups = within(menu).getAllByRole('group');
      expect(groups).toHaveLength(3);

      // First group (Field) should have age, assigned, browser.name
      const group1 = groups[0]!;
      expect(within(group1).getByRole('option', {name: 'age'})).toBeInTheDocument();
      expect(within(group1).getByRole('option', {name: 'assigned'})).toBeInTheDocument();
      expect(
        within(group1).getByRole('option', {name: 'browser.name'})
      ).toBeInTheDocument();

      // Second group (Tag) should have custom_tag_name
      const group2 = groups[1]!;
      expect(
        within(group2).getByRole('option', {name: 'custom_tag_name'})
      ).toBeInTheDocument();

      // There should be a third group for uncategorized keys
      const group3 = groups[2]!;
      expect(
        within(group3).getByRole('option', {name: 'uncategorized_tag'})
      ).toBeInTheDocument();

      // Clicking "Category 2" should filter the options to only category 2
      await userEvent.click(screen.getByRole('button', {name: 'Category 2'}));
      await waitFor(() => {
        expect(screen.queryByRole('option', {name: 'age'})).not.toBeInTheDocument();
      });
      expect(screen.getByRole('option', {name: 'custom_tag_name'})).toBeInTheDocument();
    });

    it('can navigate between sections with arrow keys', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(getLastInput());
      expect(screen.getByRole('button', {name: 'All'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Arrow right while an option is not focused does nothing
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', {name: 'All'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Arrowing down to an option and arrowing to the right should select the first section
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
      expect(screen.getByRole('button', {name: 'Category 1'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    describe('recent filter keys', function () {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/recent-searches/',
          body: [
            {query: 'assigned:me'},
            {query: 'assigned:me browser.name:firefox'},
            {query: 'assigned:me browser.name:firefox is:unresolved'},
          ],
        });
      });

      it('can select from recently-used filter keys', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} recentSearches={SavedSearchType.ISSUE} />
        );

        await userEvent.click(getLastInput());

        const recentFilterKeys = await screen.findAllByTestId('recent-filter-key');

        expect(recentFilterKeys).toHaveLength(3);
        expect(recentFilterKeys[0]).toHaveTextContent('assigned');
        expect(recentFilterKeys[1]).toHaveTextContent('browser');
        expect(recentFilterKeys[2]).toHaveTextContent('is');

        await userEvent.click(recentFilterKeys[0]!);

        expect(await screen.findByRole('row', {name: 'assigned:""'})).toBeInTheDocument();
      });

      it('does not display filters present in the query', async function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            recentSearches={SavedSearchType.ISSUE}
            initialQuery="assigned:me"
          />
        );

        await userEvent.click(getLastInput());

        // Should not show "assigned" in the recent filter keys
        const recentFilterKeys = await screen.findAllByTestId('recent-filter-key');
        expect(recentFilterKeys).toHaveLength(2);
        expect(recentFilterKeys[0]).toHaveTextContent('browser');
        expect(recentFilterKeys[1]).toHaveTextContent('is');
      });

      it('does not display recent filters that are not valid filter keys', async function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/recent-searches/',
          body: [
            // Level is not a valid filter key
            {query: 'assigned:me level:error'},
          ],
        });

        render(
          <SearchQueryBuilder {...defaultProps} recentSearches={SavedSearchType.ISSUE} />
        );

        await userEvent.click(getLastInput());

        // Should not show "level" in the recent filter keys
        const recentFilterKeys = await screen.findAllByTestId('recent-filter-key');
        expect(recentFilterKeys).toHaveLength(1);
        expect(recentFilterKeys[0]).toHaveTextContent('assigned');
      });

      it('can navigate up/down from recent filter gutter to other search keys', async function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            recentSearches={SavedSearchType.ISSUE}
            initialQuery="is:unresolved"
          />
        );

        await userEvent.click(getLastInput());

        const recentFilterKeys = await screen.findAllByTestId('recent-filter-key');

        // Arrow down once should focus the first recent filter key
        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getLastInput()).toHaveAttribute(
            'aria-activedescendant',
            recentFilterKeys[0]!.id
          );
        });

        // Arrow right should go to the next recent filter
        await userEvent.keyboard('{ArrowRight}');
        await waitFor(() => {
          expect(getLastInput()).toHaveAttribute(
            'aria-activedescendant',
            recentFilterKeys[1]!.id
          );
        });

        // Arrow down again skip to the next non-recent filter key
        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getLastInput()).toHaveAttribute(
            'aria-activedescendant',
            screen.getByRole('option', {name: 'age'}).id
          );
        });

        // Arrow up should go back to the first recent filter key
        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(getLastInput()).toHaveAttribute(
            'aria-activedescendant',
            recentFilterKeys[0]!.id
          );
        });
      });
    });

    describe('recent searches', function () {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/recent-searches/',
          body: [{query: 'assigned:me'}, {query: 'some recent query'}],
        });
      });

      it('displays recent search queries when query is empty', async function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            recentSearches={SavedSearchType.ISSUE}
            initialQuery=""
          />
        );

        await userEvent.click(getLastInput());

        // Should have a "Recent" category
        expect(await screen.findByRole('button', {name: 'Recent'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'assigned:me'})).toBeInTheDocument();
        expect(
          screen.getByRole('option', {name: 'some recent query'})
        ).toBeInTheDocument();
      });

      it('switches to keys menu when recent searches no longer exist', async function () {
        const {rerender} = render(
          <SearchQueryBuilder
            {...defaultProps}
            recentSearches={SavedSearchType.ISSUE}
            initialQuery=""
          />
        );

        await userEvent.click(getLastInput());

        // Recent should be selected
        expect(screen.getByRole('button', {name: 'Recent'})).toHaveAttribute(
          'aria-selected',
          'true'
        );

        // Rerender without recent searches
        rerender(<SearchQueryBuilder {...defaultProps} />);

        // Recent should not exist anymore
        expect(screen.queryByRole('button', {name: 'Recent'})).not.toBeInTheDocument();
        // All should be selected
        expect(screen.getByRole('button', {name: 'All'})).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });

      it('when selecting a recent search, should reset query and call onSearch', async function () {
        const mockOnSearch = jest.fn();
        const mockCreateRecentSearch = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/recent-searches/',
          method: 'POST',
        });

        render(
          <SearchQueryBuilder
            {...defaultProps}
            recentSearches={SavedSearchType.ISSUE}
            initialQuery=""
            onSearch={mockOnSearch}
          />
        );

        await userEvent.click(getLastInput());

        await userEvent.click(await screen.findByRole('option', {name: 'assigned:me'}));
        await waitFor(() => {
          expect(mockOnSearch).toHaveBeenCalledWith('assigned:me', expect.anything());
        });

        // Focus should be at the end of the query
        await waitFor(() => {
          expect(getLastInput()).toHaveFocus();
        });

        // Should call the endpoint to add this as a recent search
        expect(mockCreateRecentSearch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {query: 'assigned:me', type: SavedSearchType.ISSUE},
          })
        );
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
      await userEvent.click(screen.getByRole('option', {name: 'is not'}));

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

    it('can click and drag to select tokens', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="is:unresolved" />);

      const grid = screen.getByRole('grid');
      const tokens = screen.getAllByRole('row');
      const freeText1 = tokens[0];
      const filter = tokens[1];
      const freeText2 = tokens[2];

      // jsdom does not support getBoundingClientRect, so we need to mock it for each item

      // First freeText area is 5px wide
      freeText1!.getBoundingClientRect = () => {
        return {
          top: 0,
          left: 10,
          bottom: 10,
          right: 15,
          width: 5,
          height: 10,
        } as DOMRect;
      };
      // "is:unresolved" filter is 100px wide
      filter!.getBoundingClientRect = () => {
        return {
          top: 0,
          left: 15,
          bottom: 10,
          right: 115,
          width: 100,
          height: 10,
        } as DOMRect;
      };
      // Last freeText area is 200px wide
      freeText2!.getBoundingClientRect = () => {
        return {
          top: 0,
          left: 115,
          bottom: 10,
          right: 315,
          width: 200,
          height: 10,
        } as DOMRect;
      };

      // Note that jsdom does not do layout, so all coordinates are 0, 0
      await userEvent.pointer([
        // Start with 0, 5 so that we are on the first token
        {keys: '[MouseLeft>]', target: grid, coords: {x: 0, y: 5}},
        // Move to 50, 5 (within filter token)
        {target: grid, coords: {x: 50, y: 5}},
      ]);

      // all should be selected except the last free text
      await waitFor(() => {
        expect(freeText1).toHaveAttribute('aria-selected', 'true');
      });
      expect(filter).toHaveAttribute('aria-selected', 'true');
      expect(freeText2).toHaveAttribute('aria-selected', 'false');

      // Now move pointer to the end and below to select everything
      await userEvent.pointer([{target: grid, coords: {x: 400, y: 50}}]);

      // All tokens should be selected
      await waitFor(() => {
        expect(freeText2).toHaveAttribute('aria-selected', 'true');
      });
      expect(freeText1).toHaveAttribute('aria-selected', 'true');
      expect(filter).toHaveAttribute('aria-selected', 'true');

      // Now move pointer back to original position
      await userEvent.pointer([
        // Move to 100, 1 to select all tokens (which are at 0, 0)
        {target: grid, coords: {x: 0, y: 5}},
        // Release mouse button to finish selection
        {keys: '[/MouseLeft]', target: getLastInput()},
      ]);

      // All tokens should be deselected
      await waitFor(() => {
        expect(freeText1).toHaveAttribute('aria-selected', 'false');
      });
      expect(filter).toHaveAttribute('aria-selected', 'false');
      expect(freeText2).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('new search tokens', function () {
    it('can add an unsupported filter key and value', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(getLastInput());

      // Typing "foo", then " a:b" should add the "foo" text followed by a new token "a:b"
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'foo a:b{enter}'
      );
      expect(screen.getByRole('row', {name: 'foo'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'a:b'})).toBeInTheDocument();
    });

    it('adds default value for filter when typing <filter>:', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(getLastInput());

      // Typing `is:` and escaping should result in `is:unresolved`
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'is:{escape}'
      );
      expect(await screen.findByRole('row', {name: 'is:unresolved'})).toBeInTheDocument();
    });

    it('does not automatically create a filter if the user intends to wrap in quotes', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(getLastInput());

      // Starting with an opening quote and typing out Error: should stay as raw text
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        '"Error: foo"'
      );
      await waitFor(() => {
        expect(getLastInput()).toHaveValue('"Error: foo"');
      });
    });

    it('can search by key description', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.keyboard('assignee');

      // "assignee" is in the description of "assigned"
      expect(await screen.findByRole('option', {name: 'assigned'})).toBeInTheDocument();
    });

    it('can add a new token by clicking a key suggestion', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(screen.getByRole('option', {name: 'browser.name'}));

      // New token should be added with the correct key and default value
      expect(screen.getByRole('row', {name: 'browser.name:""'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('option', {name: 'Firefox'}));

      // New token should have a value
      expect(screen.getByRole('row', {name: 'browser.name:Firefox'})).toBeInTheDocument();
    });

    it('can add free text by typing', async function () {
      const mockOnSearch = jest.fn();
      render(<SearchQueryBuilder {...defaultProps} onSearch={mockOnSearch} />);

      await userEvent.click(getLastInput());
      await userEvent.type(screen.getByRole('combobox'), 'some free text{enter}');
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('some free text', expect.anything());
      });
      // Should still have text in the input
      expect(screen.getByRole('combobox')).toHaveValue('some free text');
      // Should have closed the menu
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    });

    it('can add a filter after some free text', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(getLastInput());

      // XXX(malwilley): SearchQueryBuilderInput updates state in the render
      // function which causes an act warning despite using userEvent.click.
      // Cannot find a way to avoid this warning.
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      await userEvent.type(screen.getByRole('combobox'), 'some free text brow');
      await userEvent.click(screen.getByRole('option', {name: 'browser.name'}));
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

      await userEvent.click(getLastInput());
      await userEvent.keyboard('(');

      expect(await screen.findByRole('row', {name: '('})).toBeInTheDocument();

      expect(getLastInput()).toHaveFocus();
    });

    it('focuses the correct text input after typing boolean operators', async function () {
      render(<SearchQueryBuilder {...defaultProps} />);

      await userEvent.click(getLastInput());

      // XXX(malwilley): SearchQueryBuilderInput updates state in the render
      // function which causes an act warning despite using userEvent.click.
      // Cannot find a way to avoid this warning.
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      await userEvent.keyboard('a or b{enter}');
      jest.restoreAllMocks();

      const lastInput = (await screen.findAllByTestId('query-builder-input')).at(-1);
      expect(lastInput).toHaveFocus();

      await userEvent.click(getLastInput());

      // Should have three tokens: a, or, b
      await screen.findByRole('row', {name: /a/});
      await screen.findByRole('row', {name: /or/});
      await screen.findByRole('row', {name: /b/});
    });
  });

  describe('filter key suggestions', function () {
    it('will suggest a filter key when typing its value', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="" />);
      await userEvent.click(getLastInput());

      // Typing "firefox" should show suggestions for the filter "browser.name"
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'firefox'
      );
      const suggestionItem = await screen.findByRole('option', {
        name: 'browser.name:Firefox',
      });

      // Clicking it should add the filter and put focus at the end
      await userEvent.click(suggestionItem);
      expect(screen.getByRole('row', {name: 'browser.name:Firefox'})).toBeInTheDocument();
      expect(getLastInput()).toHaveFocus();
    });

    it('will suggest a raw search when typing with a space', async function () {
      const mockOnSearch = jest.fn();
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="" onSearch={mockOnSearch} />
      );
      await userEvent.click(getLastInput());

      // Typing "foo bar" should show a suggestion for the raw search "foo bar"
      await userEvent.type(
        screen.getByRole('combobox', {name: 'Add a search term'}),
        'foo bar'
      );
      const suggestionItem = await screen.findByRole('option', {
        name: '"foo bar"',
      });

      // Clicking it should add quotes and fire the search
      await userEvent.click(suggestionItem);
      expect(screen.getByRole('row', {name: '"foo bar"'})).toBeInTheDocument();
      expect(getLastInput()).toHaveFocus();
      expect(mockOnSearch).toHaveBeenCalledWith('"foo bar"', expect.anything());
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
      await userEvent.click(getLastInput());

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
        screen.getAllByRole('combobox', {name: 'Add a search term'})[0]!
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

      await userEvent.click(getLastInput());

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
        screen.getByRole('button', {name: 'Edit key for filter: assigned'})
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

    it('skips over tokens when navigating with ctrl+arrow keys', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox assigned:me"
        />
      );

      await userEvent.click(getLastInput());

      expect(getLastInput()).toHaveFocus();

      // Ctrl+ArrowLeft should skip to the input to the left of assigned:me
      await userEvent.keyboard('{Control>}{ArrowLeft}{/Control}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-2)
      ).toHaveFocus();

      // Ctrl+ArrowRight should go back to the last input
      await userEvent.keyboard('{Control>}{ArrowRight}{/Control}');
      expect(getLastInput()).toHaveFocus();
    });

    it('extends selection with shift+arrow keys', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox assigned:me"
        />
      );

      await userEvent.click(getLastInput());

      // Shift+ArrowLeft should select assigned:me
      await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
      await waitFor(() => {
        expect(screen.getByRole('row', {name: 'assigned:me'})).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });

      // Shift+ArrowLeft again should select browser.name
      await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
      await waitFor(() => {
        expect(screen.getByRole('row', {name: 'browser.name:firefox'})).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
      // assigned:me should still be selected
      expect(screen.getByRole('row', {name: 'assigned:me'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Shift+ArrowRight should unselect browser.name:firefox
      await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
      await waitFor(() => {
        expect(
          screen.getByRole('row', {name: 'browser.name:firefox'})
        ).not.toHaveAttribute('aria-selected', 'true');
      });
      // assigned:me should still be selected
      expect(screen.getByRole('row', {name: 'assigned:me'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('when focus is in a filter segment, backspace first focuses the filter then deletes it', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      // Focus the filter operator dropdown
      const opButton = await screen.findByRole('button', {
        name: 'Edit operator for filter: browser.name',
      });
      await act(() => opButton.focus());

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

      await userEvent.click(getLastInput());
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

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{backspace}{backspace}');

      expect(screen.queryByRole('row', {name: '('})).not.toBeInTheDocument();
    });

    it('can remove boolean ops with the keyboard', async function () {
      render(<SearchQueryBuilder {...defaultProps} initialQuery="and" />);

      expect(screen.getByRole('row', {name: 'and'})).toBeInTheDocument();

      await userEvent.click(getLastInput());
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

    it('backspace focuses filter when input is empty', async function () {
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

      // Filter should now have focus, and no changes should have been made
      expect(screen.getByRole('row', {name: 'age:-24h'})).toHaveFocus();
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

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Control>}a{/Control}');

      // Should have selected the entire query
      for (const token of screen.getAllByRole('row')) {
        expect(token).toHaveAttribute('aria-selected', 'true');
      }

      // Focus should be on the selection key handler input
      expect(screen.getByTestId('selection-key-handler')).toHaveFocus();

      // Pressing delete should remove all selected tokens
      await userEvent.keyboard('{Backspace}');
      expect(mockOnChange).toHaveBeenCalledWith('', expect.anything());
    });

    it('focus goes to first input after ctrl+a and arrow left', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
      );

      await userEvent.click(getLastInput());
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

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Control>}a{/Control}');

      // Pressing arrow right should put focus in last text input
      await userEvent.keyboard('{ArrowRight}');
      expect(
        screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1)
      ).toHaveFocus();
    });

    it('replaces selection when a key is pressed', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
        />
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('foo');
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();
      expect(getLastInput()).toHaveFocus();
      expect(getLastInput()).toHaveValue('foo');
    });

    it('replaces selection with pasted content with ctrl+v', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
        />
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.paste('foo');
      expect(
        screen.queryByRole('row', {name: 'browser.name:firefox'})
      ).not.toBeInTheDocument();
      expect(getLastInput()).toHaveFocus();
      expect(getLastInput()).toHaveValue('foo');
    });

    it('can copy selection with ctrl-c', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox foo" />
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('{Control>}c{/Control}');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'browser.name:firefox foo'
      );
    });

    it('can cut selection with ctrl-x', async function () {
      const mockOnChange = jest.fn();
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="browser.name:firefox"
          onChange={mockOnChange}
        />
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('{Control>}x{/Control}');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('browser.name:firefox');
      expect(mockOnChange).toHaveBeenCalledWith('', expect.anything());
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
      expect(within(groups[0]!).getByRole('option', {name: 'me'})).toBeInTheDocument();
      // Second group is the remaining option in the "Suggested" section
      expect(
        within(groups[1]!).getByRole('option', {name: 'unassigned'})
      ).toBeInTheDocument();
      // Third group are the options under the "All" section
      expect(
        within(groups[2]!).getByRole('option', {name: 'person1@sentry.io'})
      ).toBeInTheDocument();
      expect(
        within(groups[2]!).getByRole('option', {name: 'person2@sentry.io'})
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

      it('defaults to unresolved when there is no value', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="is:" />);

        // Click into value and press enter with no value
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: is'})
        );
        await userEvent.keyboard('{enter}');

        // Should be is:unresolved
        expect(
          await screen.findByRole('row', {name: 'is:unresolved'})
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
          expect(mockOnChange).toHaveBeenCalledWith('!has:key', expect.anything());
        });
        expect(
          within(
            screen.getByRole('button', {name: 'Edit operator for filter: has'})
          ).getByText('does not have')
        ).toBeInTheDocument();
      });
    });

    describe('string', function () {
      it('defaults to an empty string when no value is provided', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );
        await userEvent.clear(
          await screen.findByRole('combobox', {name: 'Edit filter value'})
        );
        await userEvent.keyboard('{enter}');

        // Should have empty quotes `""`
        expect(
          await screen.findByRole('row', {name: 'browser.name:""'})
        ).toBeInTheDocument();
        expect(
          within(
            screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
          ).getByText('""')
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
        await userEvent.click(screen.getByRole('option', {name: 'is not'}));

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

      it('can modify the key by clicking into it', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit key for filter: browser.name'})
        );
        // Should start with an empty input
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter key'})).toHaveValue('');
        });

        await userEvent.click(screen.getByRole('option', {name: 'custom_tag_name'}));

        await waitFor(() => {
          expect(
            screen.getByRole('row', {name: 'custom_tag_name:firefox'})
          ).toBeInTheDocument();
        });
        expect(getLastInput()).toHaveFocus();
      });

      it('resets the filter value when changing filter key to a different type', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit key for filter: browser.name'})
        );
        // Should start with an empty input
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter key'})).toHaveValue('');
        });

        await userEvent.click(screen.getByRole('option', {name: 'age'}));

        await waitFor(() => {
          expect(screen.getByRole('row', {name: 'age:-24h'})).toBeInTheDocument();
        });
        // Filter value should have focus
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
      });

      it('keeps focus inside value when multi-selecting with checkboxes', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );
        // Input value should start with previous value and appended ','
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            'firefox,'
          );
        });

        // Toggling off the "firefox" option should:
        // - Commit an empty string as the filter value
        // - Input value should be cleared
        // - Keep focus inside the input
        await userEvent.click(
          await screen.findByRole('checkbox', {name: 'Toggle firefox'})
        );
        expect(
          await screen.findByRole('row', {name: 'browser.name:""'})
        ).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            ''
          );
        });
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();

        // Toggling on the "Chrome" option should:
        // - Commit the value "Chrome" to the filter
        // - Input value should be "Chrome,"
        // - Keep focus inside the input
        await userEvent.click(
          await screen.findByRole('checkbox', {name: 'Toggle Chrome'})
        );
        expect(
          await screen.findByRole('row', {name: 'browser.name:Chrome'})
        ).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            'Chrome,'
          );
        });
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
      });

      it('keeps focus inside value when multi-selecting with ctrl+enter', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );

        // Arrow down two places to "Chrome" option
        await userEvent.keyboard('{ArrowDown}{ArrowDown}');
        // Pressing ctrl+enter should toggle the option and keep focus inside the input
        await userEvent.keyboard('{Control>}{Enter}');
        expect(
          await screen.findByRole('row', {name: 'browser.name:[firefox,Chrome]'})
        ).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            'firefox,Chrome,'
          );
        });
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
      });

      it('keeps focus inside value when multi-selecting with ctrl+click', async function () {
        render(
          <SearchQueryBuilder {...defaultProps} initialQuery="browser.name:firefox" />
        );

        const user = userEvent.setup();

        await user.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );

        // Clicking option while holding Ctrl should toggle the option and keep focus inside the input
        await user.keyboard('{Control>}');
        await user.click(screen.getByRole('option', {name: 'Chrome'}));
        expect(
          await screen.findByRole('row', {name: 'browser.name:[firefox,Chrome]'})
        ).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
            'firefox,Chrome,'
          );
        });
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveFocus();
      });

      it('collapses many selected options', async function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            initialQuery="browser.name:[one,two,three,four]"
          />
        );

        const valueButton = await screen.findByRole('button', {
          name: 'Edit value for filter: browser.name',
        });
        expect(within(valueButton).getByText('one')).toBeInTheDocument();
        expect(within(valueButton).getByText('two')).toBeInTheDocument();
        expect(within(valueButton).getByText('three')).toBeInTheDocument();
        expect(within(valueButton).getByText('+1')).toBeInTheDocument();
        expect(within(valueButton).queryByText('four')).not.toBeInTheDocument();
        expect(within(valueButton).getAllByText('or')).toHaveLength(2);
      });

      it.each([
        ['spaces', 'a b', '"a b"'],
        ['quotes', 'a"b', '"a\\"b"'],
        ['parens', 'foo()', '"foo()"'],
        ['commas', '"a,b"', '"a,b"'],
      ])('typed tag values escape %s', async (_, value, expected) => {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="browser.name:"
          />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: browser.name'})
        );
        await userEvent.keyboard(`${value}{enter}`);

        // Value should be surrounded by quotes and escaped
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith(
            `browser.name:${expected}`,
            expect.anything()
          );
        });
      });

      it.each([
        ['spaces', 'a b', '"a b"'],
        ['quotes', 'a"b', '"a\\"b"'],
        ['parens', 'foo()', '"foo()"'],
        ['commas', 'a,b', '"a,b"'],
      ])('selected tag value suggestions escape %s', async (_, value, expected) => {
        const mockOnChange = jest.fn();
        const mockGetTagValues = jest.fn().mockResolvedValue([value]);
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="custom_tag_name:"
            getTagValues={mockGetTagValues}
          />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: custom_tag_name'})
        );
        await userEvent.click(await screen.findByRole('option', {name: value}));

        // Value should be surrounded by quotes and escaped
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalledWith(
            `custom_tag_name:${expected}`,
            expect.anything()
          );
        });

        // Open menu again and check to see if value is correct
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: custom_tag_name'})
        );

        // Input value should have the escaped value (with a trailing comma)
        expect(screen.getByRole('combobox', {name: 'Edit filter value'})).toHaveValue(
          expected + ','
        );

        // The original value should be selected in the dropdown
        expect(
          within(await screen.findByRole('option', {name: value})).getByRole('checkbox')
        ).toBeChecked();
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

      it('displays comparison operator values with allowAllOperators: true', async function () {
        const filterKeys = {
          [FieldKey.RELEASE_VERSION]: {
            key: FieldKey.RELEASE_VERSION,
            name: '',
            allowAllOperators: true,
          },
        };
        render(
          <SearchQueryBuilder
            {...defaultProps}
            filterKeys={filterKeys}
            filterKeySections={[]}
            initialQuery="release.version:1.0"
          />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: release.version'})
        );

        // Normally text filters only have 'is' and 'is not' as options
        expect(await screen.findByRole('option', {name: '>'})).toBeInTheDocument();
        await userEvent.click(screen.getByRole('option', {name: '>'}));

        expect(
          await screen.findByRole('row', {name: 'release.version:>1.0'})
        ).toBeInTheDocument();
      });
    });

    describe('numeric', function () {
      it('new numeric filters start with a value', async function () {
        render(<SearchQueryBuilder {...defaultProps} />);
        await userEvent.click(getLastInput());
        await userEvent.keyboard('time{ArrowDown}{Enter}');

        // Should start with the > operator and a value of 100
        expect(
          await screen.findByRole('row', {name: 'timesSeen:>100'})
        ).toBeInTheDocument();
      });

      it('keeps previous value when confirming empty value', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...defaultProps}
            onChange={mockOnChange}
            initialQuery="timesSeen:>5"
          />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: timesSeen'})
        );
        await userEvent.clear(
          await screen.findByRole('combobox', {name: 'Edit filter value'})
        );
        await userEvent.keyboard('{enter}');

        // Should have the same value
        expect(
          await screen.findByRole('row', {name: 'timesSeen:>5'})
        ).toBeInTheDocument();
        expect(mockOnChange).not.toHaveBeenCalled();
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
        await userEvent.click(screen.getByRole('option', {name: '<='}));

        expect(
          await screen.findByRole('row', {name: 'timesSeen:<=100k'})
        ).toBeInTheDocument();
      });
    });

    describe('duration', function () {
      const durationFilterKeys: TagCollection = {
        duration: {
          key: 'duration',
          name: 'Duration',
        },
      };

      const fieldDefinitionGetter: FieldDefinitionGetter = () => ({
        valueType: FieldValueType.DURATION,
        kind: FieldKind.FIELD,
      });

      const durationProps: SearchQueryBuilderProps = {
        ...defaultProps,
        filterKeys: durationFilterKeys,
        filterKeySections: [],
        fieldDefinitionGetter,
      };

      it('new duration filters start with greater than operator and default value', async function () {
        render(<SearchQueryBuilder {...durationProps} />);
        await userEvent.click(getLastInput());
        await userEvent.click(screen.getByRole('option', {name: 'duration'}));

        // Should start with the > operator and a value of 10ms
        expect(
          await screen.findByRole('row', {name: 'duration:>10ms'})
        ).toBeInTheDocument();
      });

      it('duration filters have the correct operator options', async function () {
        render(<SearchQueryBuilder {...durationProps} initialQuery="duration:>100ms" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: duration'})
        );

        expect(await screen.findByRole('option', {name: 'is'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'is not'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '>'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '<'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '>='})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '<='})).toBeInTheDocument();
      });

      it('duration filters have the correct value suggestions', async function () {
        render(<SearchQueryBuilder {...durationProps} initialQuery="duration:>100ms" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: duration'})
        );

        // Default suggestions
        expect(await screen.findByRole('option', {name: '100ms'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '100s'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '100m'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '100h'})).toBeInTheDocument();

        // Entering a number will show unit suggestions for that value
        await userEvent.keyboard('7');
        expect(await screen.findByRole('option', {name: '7ms'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '7s'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '7m'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '7h'})).toBeInTheDocument();
      });

      it('duration filters can change operator', async function () {
        render(<SearchQueryBuilder {...durationProps} initialQuery="duration:>100ms" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: duration'})
        );

        await userEvent.click(await screen.findByRole('option', {name: '<='}));

        expect(
          await screen.findByRole('row', {name: 'duration:<=100ms'})
        ).toBeInTheDocument();
      });

      it('duration filters do not allow invalid values', async function () {
        render(<SearchQueryBuilder {...durationProps} initialQuery="duration:>100ms" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: duration'})
        );

        await userEvent.keyboard('a{Enter}');

        // Should have the same value because "a" is not a numeric value
        expect(screen.getByRole('row', {name: 'duration:>100ms'})).toBeInTheDocument();

        await userEvent.keyboard('{Backspace}7m{Enter}');

        // Should accept "7m" as a valid value
        expect(
          await screen.findByRole('row', {name: 'duration:>7m'})
        ).toBeInTheDocument();
      });

      it('duration filters will add a default unit to entered numbers', async function () {
        render(<SearchQueryBuilder {...durationProps} initialQuery="duration:>100ms" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: duration'})
        );

        await userEvent.keyboard('7{Enter}');

        // Should accept "7" and add "ms" as the default unit
        expect(
          await screen.findByRole('row', {name: 'duration:>7ms'})
        ).toBeInTheDocument();
      });

      it('keeps previous value when confirming empty value', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...durationProps}
            onChange={mockOnChange}
            initialQuery="duration:>100ms"
          />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: duration'})
        );
        await userEvent.clear(
          await screen.findByRole('combobox', {name: 'Edit filter value'})
        );
        await userEvent.keyboard('{enter}');

        // Should have the same value
        expect(
          await screen.findByRole('row', {name: 'duration:>100ms'})
        ).toBeInTheDocument();
        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });

    describe('percentage', function () {
      const percentageFilterKeys: TagCollection = {
        rate: {
          key: 'rate',
          name: 'rate',
        },
      };

      const fieldDefinitionGetter: FieldDefinitionGetter = () => ({
        valueType: FieldValueType.PERCENTAGE,
        kind: FieldKind.FIELD,
      });

      const percentageProps: SearchQueryBuilderProps = {
        ...defaultProps,
        filterKeys: percentageFilterKeys,
        filterKeySections: [],
        fieldDefinitionGetter,
      };

      it('new percentage filters start with greater than operator and default value', async function () {
        render(<SearchQueryBuilder {...percentageProps} />);
        await userEvent.click(getLastInput());
        await userEvent.click(screen.getByRole('option', {name: 'rate'}));

        // Should start with the > operator and a value of 50%
        expect(await screen.findByRole('row', {name: 'rate:>0.5'})).toBeInTheDocument();
      });

      it('percentage filters have the correct operator options', async function () {
        render(<SearchQueryBuilder {...percentageProps} initialQuery="rate:>0.5" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: rate'})
        );

        expect(await screen.findByRole('option', {name: 'is'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: 'is not'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '>'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '<'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '>='})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '<='})).toBeInTheDocument();
      });

      it('percentage filters can change operator', async function () {
        render(<SearchQueryBuilder {...percentageProps} initialQuery="rate:>0.5" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: rate'})
        );

        await userEvent.click(await screen.findByRole('option', {name: '<='}));

        expect(await screen.findByRole('row', {name: 'rate:<=0.5'})).toBeInTheDocument();
      });

      it('percentage filters do not allow invalid values', async function () {
        render(<SearchQueryBuilder {...percentageProps} initialQuery="rate:>0.5" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: rate'})
        );

        await userEvent.keyboard('a{Enter}');

        // Should have the same value because "a" is not a numeric value
        expect(screen.getByRole('row', {name: 'rate:>0.5'})).toBeInTheDocument();

        await userEvent.keyboard('{Backspace}0.2{Enter}');

        // Should accept "0.2" as a valid value
        expect(await screen.findByRole('row', {name: 'rate:>0.2'})).toBeInTheDocument();
      });

      it('percentage filters will convert values with % to ratio', async function () {
        render(<SearchQueryBuilder {...percentageProps} initialQuery="rate:>0.5" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: rate'})
        );

        await userEvent.keyboard('70%{Enter}');

        // 70% should be accepted and converted to 0.7
        expect(await screen.findByRole('row', {name: 'rate:>0.7'})).toBeInTheDocument();
      });

      it('keeps previous value when confirming empty value', async function () {
        const mockOnChange = jest.fn();
        render(
          <SearchQueryBuilder
            {...percentageProps}
            onChange={mockOnChange}
            initialQuery="rate:>0.5"
          />
        );

        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: rate'})
        );
        await userEvent.clear(
          await screen.findByRole('combobox', {name: 'Edit filter value'})
        );
        await userEvent.keyboard('{enter}');

        // Should have the same value
        expect(await screen.findByRole('row', {name: 'rate:>0.5'})).toBeInTheDocument();
        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });

    describe('date', function () {
      // Transpile the lazy-loaded datepicker up front so tests don't flake
      beforeAll(async function () {
        await import('sentry/components/calendar/datePicker');
      });

      it('new date filters start with a value', async function () {
        render(<SearchQueryBuilder {...defaultProps} />);
        await userEvent.click(getLastInput());
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

      it('keeps previous value when confirming empty value', async function () {
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
        await userEvent.clear(
          await screen.findByRole('combobox', {name: 'Edit filter value'})
        );
        await userEvent.keyboard('{enter}');

        // Should have the same value
        expect(await screen.findByRole('row', {name: 'age:-24h'})).toBeInTheDocument();
        expect(mockOnChange).not.toHaveBeenCalled();
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
        await userEvent.click(await screen.findByRole('option', {name: 'is before'}));

        // Should flip from "-" to "+"
        expect(await screen.findByRole('row', {name: 'age:+24h'})).toBeInTheDocument();
      });

      it('can type relative date shorthand (7d)', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit value for filter: age'})
        );

        await userEvent.keyboard('7d{Enter}');

        expect(await screen.findByRole('row', {name: 'age:-7d'})).toBeInTheDocument();
      });

      it('switches to an absolute date when choosing operator with equality', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:-24h" />);
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit operator for filter: age'})
        );
        await userEvent.click(
          await screen.findByRole('option', {name: 'is on or after'})
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
          expect(mockOnChange).toHaveBeenCalledWith('foo age:-1h', expect.anything());
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
          expect(mockOnChange).toHaveBeenCalledWith('foo age:+1h', expect.anything());
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
          expect(mockOnChange).toHaveBeenCalledWith('age:>2017-10-17', expect.anything());
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
          expect(mockOnChange).toHaveBeenCalledWith(
            'age:>2017-10-17T00:00:00Z',
            expect.anything()
          );
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
          expect(mockOnChange).toHaveBeenCalledWith(
            'age:>2017-10-17T00:00:00+00:00',
            expect.anything()
          );
        });
      });

      it('displays absolute date value correctly (just date)', async function () {
        render(<SearchQueryBuilder {...defaultProps} initialQuery="age:>=2017-10-17" />);

        expect(await screen.findByText('is on or after')).toBeInTheDocument();
        expect(screen.getByText('Oct 17')).toBeInTheDocument();
      });

      it('displays absolute date value correctly (with local time)', async function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            initialQuery="age:>=2017-10-17T14:00:00-00:00"
          />
        );

        expect(await screen.findByText('is on or after')).toBeInTheDocument();
        expect(screen.getByText('Oct 17, 2:00 PM')).toBeInTheDocument();
      });

      it('displays absolute date value correctly (with UTC time)', async function () {
        render(
          <SearchQueryBuilder
            {...defaultProps}
            initialQuery="age:>=2017-10-17T14:00:00Z"
          />
        );

        expect(await screen.findByText('is on or after')).toBeInTheDocument();
        expect(screen.getByText('Oct 17, 2:00 PM UTC')).toBeInTheDocument();
      });
    });

    describe('aggregate filters', function () {
      const aggregateFilterKeys: TagCollection = {
        count: {
          key: 'count',
          name: 'count',
          kind: FieldKind.FUNCTION,
        },
        count_if: {
          key: 'count_if',
          name: 'count_if',
          kind: FieldKind.FUNCTION,
        },
        p95: {
          key: 'p95',
          name: 'p95',
          kind: FieldKind.FUNCTION,
        },
        'transaction.duration': {
          key: 'transaction.duration',
          name: 'transaction.duration',
          kind: FieldKind.FIELD,
        },
        timesSeen: {
          key: 'timesSeen',
          name: 'timesSeen',
          kind: FieldKind.FIELD,
        },
        lastSeen: {
          key: 'lastSeen',
          name: 'lastSeen',
          kind: FieldKind.FIELD,
        },
      };

      const aggregateGetFieldDefinition: FieldDefinitionGetter = key => {
        switch (key) {
          case 'count':
            return {
              desc: 'count() description',
              kind: FieldKind.FUNCTION,
              valueType: FieldValueType.INTEGER,
              parameters: [],
            };
          case 'count_if':
            return {
              desc: 'count_if() description',
              kind: FieldKind.FUNCTION,
              valueType: FieldValueType.INTEGER,
              parameters: [
                {
                  name: 'column',
                  kind: 'column' as const,
                  columnTypes: [
                    FieldValueType.STRING,
                    FieldValueType.NUMBER,
                    FieldValueType.DURATION,
                  ],
                  defaultValue: 'transaction.duration',
                  required: true,
                },
                {
                  name: 'operator',
                  kind: 'value' as const,
                  options: [{value: 'less'}, {value: 'greater'}],
                  dataType: FieldValueType.STRING,
                  defaultValue: 'greater',
                  required: true,
                },
                {
                  name: 'value',
                  kind: 'value' as const,
                  dataType: FieldValueType.STRING,
                  defaultValue: '300ms',
                  required: false,
                },
              ],
            };
          case 'p95':
            return {
              desc: 'Returns results with the 95th percentile of the selected column.',
              kind: FieldKind.FUNCTION,
              defaultValue: '300ms',
              valueType: null,
              parameterDependentValueType: parameters => {
                const column = parameters[0];
                const fieldDef = column ? getFieldDefinition(column) : null;
                return fieldDef?.valueType ?? FieldValueType.NUMBER;
              },
              parameters: [
                {
                  name: 'column',
                  kind: 'column' as const,
                  columnTypes: [
                    FieldValueType.DURATION,
                    FieldValueType.NUMBER,
                    FieldValueType.INTEGER,
                    FieldValueType.PERCENTAGE,
                  ],
                  defaultValue: 'transaction.duration',
                  required: true,
                },
              ],
            };
          default:
            return getFieldDefinition(key);
        }
      };

      const aggregateDefaultProps: SearchQueryBuilderProps = {
        ...defaultProps,
        filterKeys: aggregateFilterKeys,
        fieldDefinitionGetter: aggregateGetFieldDefinition,
        filterKeySections: [],
      };

      it('can add an aggregate filter with default values', async function () {
        render(<SearchQueryBuilder {...aggregateDefaultProps} />);
        await userEvent.click(getLastInput());
        await userEvent.click(screen.getByRole('option', {name: 'count_if(...)'}));

        expect(
          await screen.findByRole('row', {
            name: 'count_if(transaction.duration,greater,300ms):>100',
          })
        ).toBeInTheDocument();
      });

      it('can modify parameter with predefined options', async function () {
        render(
          <SearchQueryBuilder
            {...aggregateDefaultProps}
            initialQuery="count_if(transaction.duration,):>100"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit parameters for filter: count_if'})
        );
        const input = await screen.findByRole('combobox', {
          name: 'Edit function parameters',
        });
        expect(input).toHaveFocus();
        expect(input).toHaveValue('transaction.duration,');

        await userEvent.click(await screen.findByRole('option', {name: 'less'}));
        await waitFor(() => {
          expect(input).toHaveValue('transaction.duration,less');
        });
        // Cursor should be at end of `less`
        expect((input as HTMLInputElement).selectionStart).toBe(25);

        expect(
          await screen.findByRole('row', {
            name: 'count_if(transaction.duration,less):>100',
          })
        ).toBeInTheDocument();
      });

      it('can modify parameter with column options', async function () {
        render(
          <SearchQueryBuilder {...aggregateDefaultProps} initialQuery="count_if():>100" />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit parameters for filter: count_if'})
        );
        const input = await screen.findByRole('combobox', {
          name: 'Edit function parameters',
        });
        expect(input).toHaveFocus();
        expect(input).toHaveValue('');

        await userEvent.click(await screen.findByRole('option', {name: 'timesSeen'}));
        await waitFor(() => {
          expect(input).toHaveValue('timesSeen');
        });
        // Cursor should be at end of `timesSeen`
        expect((input as HTMLInputElement).selectionStart).toBe(9);

        expect(
          await screen.findByRole('row', {
            name: 'count_if(timesSeen):>100',
          })
        ).toBeInTheDocument();
      });

      it('can modify parameters by typing a manual value', async function () {
        render(
          <SearchQueryBuilder
            {...aggregateDefaultProps}
            initialQuery="count_if(transaction.duration,greater,300ms):>100"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit parameters for filter: count_if'})
        );
        const input = await screen.findByRole('combobox', {
          name: 'Edit function parameters',
        });

        await userEvent.clear(input);
        await userEvent.keyboard('a,b,c{enter}');

        expect(
          await screen.findByRole('row', {
            name: 'count_if(a,b,c):>100',
          })
        ).toBeInTheDocument();
      });

      it('automatically changes the filter value if the type changes after editing parameters', async function () {
        render(
          <SearchQueryBuilder
            {...aggregateDefaultProps}
            initialQuery="p95(transaction.duration):>10ms"
          />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit parameters for filter: p95'})
        );
        const input = await screen.findByRole('combobox', {
          name: 'Edit function parameters',
        });

        await userEvent.clear(input);
        await userEvent.keyboard('timesSeen{enter}');

        // After selecting timesSeen, the value should change to a number
        expect(
          await screen.findByRole('row', {
            name: 'p95(timesSeen):>100',
          })
        ).toBeInTheDocument();
      });

      it('displays a description of the function and parameters while editing', async function () {
        render(
          <SearchQueryBuilder {...aggregateDefaultProps} initialQuery="count_if():>100" />
        );
        await userEvent.click(
          screen.getByRole('button', {name: 'Edit parameters for filter: count_if'})
        );

        const descriptionTooltip = await screen.findByRole('tooltip');
        expect(
          within(descriptionTooltip).getByText('count_if() description')
        ).toBeInTheDocument();
        expect(
          within(descriptionTooltip).getByText(
            textWithMarkupMatcher(
              'count_if(column: string, operator: string, value?: string)'
            )
          )
        ).toBeInTheDocument();
        expect(within(descriptionTooltip).getByTestId('focused-param')).toHaveTextContent(
          'column: string'
        );

        // After moving to next parameter, should now highlight 'operator'
        await userEvent.keyboard('a,');
        await waitFor(() => {
          expect(
            within(descriptionTooltip).getByTestId('focused-param')
          ).toHaveTextContent('operator: string');
        });
      });
    });
  });

  describe('disallowLogicalOperators', function () {
    it('should mark AND invalid', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          disallowLogicalOperators
          initialQuery="and"
        />
      );

      expect(screen.getByRole('row', {name: 'and'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(screen.getByRole('row', {name: 'and'}));
      expect(
        await screen.findByText('The AND operator is not allowed in this search')
      ).toBeInTheDocument();
    });

    it('should mark OR invalid', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          disallowLogicalOperators
          initialQuery="or"
        />
      );

      expect(screen.getByRole('row', {name: 'or'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(screen.getByRole('row', {name: 'or'}));
      expect(
        await screen.findByText('The OR operator is not allowed in this search')
      ).toBeInTheDocument();
    });

    it('should mark parens invalid', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          disallowLogicalOperators
          initialQuery="()"
        />
      );

      expect(screen.getByRole('row', {name: '('})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      expect(screen.getByRole('row', {name: ')'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(screen.getByRole('row', {name: '('}));
      expect(
        await screen.findByText('Parentheses are not supported in this search')
      ).toBeInTheDocument();
    });
  });

  describe('disallowWildcard', function () {
    it('should mark tokens with wildcards invalid', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          disallowWildcard
          initialQuery="browser.name:Firefox*"
        />
      );

      expect(screen.getByRole('row', {name: 'browser.name:Firefox*'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      // Put focus into token, should show error message
      await userEvent.click(getLastInput());
      await userEvent.keyboard('{ArrowLeft}');

      expect(
        await screen.findByText('Wildcards not supported in search')
      ).toBeInTheDocument();
    });

    it('should mark free text with wildcards invalid', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} disallowWildcard initialQuery="foo*" />
      );

      expect(screen.getByRole('row', {name: 'foo*'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{Escape}'); // Dismiss suggestion menu
      expect(
        await screen.findByText('Wildcards not supported in search')
      ).toBeInTheDocument();
    });
  });

  describe('disallowFreeText', function () {
    it('should mark free text invalid', async function () {
      render(
        <SearchQueryBuilder {...defaultProps} disallowFreeText initialQuery="foo" />
      );

      expect(screen.getByRole('row', {name: 'foo'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(getLastInput());
      expect(
        await screen.findByText('Free text is not supported in this search')
      ).toBeInTheDocument();
    });
  });

  describe('highlightUnsupportedFilters', function () {
    it('should mark unsupported filters as invalid', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          disallowUnsupportedFilters
          initialQuery="foo:bar"
        />
      );

      expect(screen.getByRole('row', {name: 'foo:bar'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{ArrowLeft}');
      expect(
        await screen.findByText('Invalid key. "foo" is not a supported search key.')
      ).toBeInTheDocument();
    });
  });

  describe('invalidMessages', function () {
    it('should customize invalid messages', async function () {
      render(
        <SearchQueryBuilder
          {...defaultProps}
          initialQuery="foo:"
          invalidMessages={{
            [InvalidReason.FILTER_MUST_HAVE_VALUE]: 'foo bar baz',
          }}
        />
      );

      expect(screen.getByRole('row', {name: 'foo:'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );

      await userEvent.click(getLastInput());
      await userEvent.keyboard('{ArrowLeft}');
      expect(await screen.findByText('foo bar baz')).toBeInTheDocument();
    });
  });
});
