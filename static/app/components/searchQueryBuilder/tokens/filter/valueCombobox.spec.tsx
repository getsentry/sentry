import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {
  getSelectedValuesFromText,
  prepareInputValueForSaving,
  SearchQueryBuilderValueCombobox,
  tokenSupportsMultipleValues,
} from './valueCombobox';

function SelectionOnlyPicker({onDelete}: {onDelete: () => void}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {query, parsedQuery} = useSearchQueryBuilderState();
  const token = parsedQuery?.find(item => item.type === Token.FILTER);
  return (
    <Container ref={wrapperRef}>
      <Text data-test-id="query-value">{query}</Text>
      {token && (
        <SearchQueryBuilderValueCombobox
          token={token}
          wrapperRef={wrapperRef}
          editingCommittedValue
          selectionOnly
          onCommit={() => {}}
          onDelete={onDelete}
        />
      )}
    </Container>
  );
}

describe('selection-only value picker', () => {
  it('filters existing values without committing typed text or deleting selections', async () => {
    const onDelete = jest.fn();
    render(
      <SearchQueryBuilderProvider
        initialQuery="level:error"
        filterKeys={{
          level: {
            key: 'level',
            name: 'Level',
            predefined: true,
            values: ['error', 'info', 'fatal'],
          },
        }}
        getTagValues={() => Promise.resolve([])}
        onSearch={() => {}}
        searchSource="test"
      >
        <SelectionOnlyPicker onDelete={onDelete} />
      </SearchQueryBuilderProvider>
    );

    const input = screen.getByRole('combobox', {name: 'Filter values'});
    expect(input).toHaveAttribute('placeholder', 'Filter values…');
    expect(
      screen.queryByRole('button', {name: 'Edit value: error'})
    ).not.toBeInTheDocument();
    await userEvent.type(input, 'unknown,');
    expect(screen.queryByRole('option', {name: 'unknown,'})).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('query-value')).toHaveTextContent('level:error');
    await userEvent.tab();
    expect(screen.getByTestId('query-value')).toHaveTextContent('level:error');

    await userEvent.clear(input);
    await userEvent.keyboard('{Backspace}');
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId('query-value')).toHaveTextContent('level:error');
    await userEvent.type(input, 'inf');
    expect(screen.getByRole('option', {name: 'info'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'fatal'})).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('option', {name: 'info'})).getByRole('checkbox')
    );
    expect(screen.getByTestId('query-value')).toHaveTextContent('level:[error,info]');
    await userEvent.clear(input);
    await userEvent.type(input, 'fat');
    await userEvent.click(screen.getByRole('option', {name: 'fatal'}));
    expect(screen.getByTestId('query-value')).toHaveTextContent(
      'level:[error,info,fatal]'
    );
  });
});

describe('prepareInputValueForSaving', () => {
  it('preserves manual asterisks in unquoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar')).toBe('foo*bar');
  });

  it('preserves manual asterisks in quoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo*bar"')).toBe(
      '"foo*bar"'
    );
  });

  it('preserves manual asterisks in multi-select string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar,baz*qux')).toBe(
      '[foo*bar,baz*qux]'
    );
  });

  it('preserves already-escaped dropdown values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo\\*bar,baz\\*qux')).toBe(
      '[foo\\*bar,baz\\*qux]'
    );
  });

  it('preserves already-escaped quoted dropdown values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo\\*bar"')).toBe(
      '"foo\\*bar"'
    );
  });
});

describe('getSelectedValuesFromText', () => {
  it('returns both the unescaped value and the stored text for each item', () => {
    expect(getSelectedValuesFromText('\\*\\*\\*\\*,')).toEqual([
      {value: '****', text: '\\*\\*\\*\\*', selected: true},
    ]);
  });

  it('round-trips representable backslashes before literal asterisks', () => {
    expect(getSelectedValuesFromText('foo\\\\\\*bar,')).toEqual([
      {value: 'foo\\\\*bar', text: 'foo\\\\\\*bar', selected: true},
    ]);
  });

  it('preserves manual wildcards as stored text while exposing the unescaped form', () => {
    expect(getSelectedValuesFromText('foo*,bar\\*,')).toEqual([
      {value: 'foo*', text: 'foo*', selected: true},
      {value: 'bar*', text: 'bar\\*', selected: true},
    ]);
  });
});

describe('tokenSupportsMultipleValues', () => {
  const filterKeys = {
    'release.version': {
      key: 'release.version',
      name: 'release.version',
      kind: FieldKind.FIELD,
    },
  };

  function getReleaseVersionFieldDefinition(
    overrides: Partial<FieldDefinition> = {}
  ): FieldDefinition {
    return {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowComparisonOperators: true,
      ...overrides,
    };
  }

  function getFilterToken(
    query: string,
    fieldDefinition = getReleaseVersionFieldDefinition()
  ) {
    const parsed = parseQueryBuilderValue(
      query,
      key => (key === 'release.version' ? fieldDefinition : null),
      {filterKeys}
    );
    const token = parsed?.find(t => t.type === Token.FILTER);

    if (!token) {
      throw new Error(`No filter token found in query: ${query}`);
    }

    return token;
  }

  it('allows multiple values for string filters by default', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition();

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(true);
  });

  it('does not allow multiple values when the field definition opts out', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition({
      allowMultipleValues: false,
    });

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(false);
  });

  it('does not allow multiple values for wildcard operators when the field definition opts out', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition({
      allowMultipleValues: false,
    });

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:*1.0.0*', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(false);
  });

  it('does not allow multiple values for comparison operators when the field definition opts out', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition({
      allowMultipleValues: false,
    });

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:>1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(false);
  });

  it('allows multiple values for comparison operators when the field definition allows them', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowComparisonOperators: true,
    };

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:>1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(true);
  });
});
import {useRef} from 'react';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
