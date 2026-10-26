import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {KeyDescription} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import type {Tag} from 'sentry/types/group';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

function renderKeyDescription(tag: Tag, fieldDefinitionGetter?: FieldDefinitionGetter) {
  render(
    <SearchQueryBuilderProvider
      fieldDefinitionGetter={fieldDefinitionGetter}
      filterKeys={{[tag.key]: tag}}
      getTagValues={() => Promise.resolve([])}
      initialQuery=""
      searchSource="test"
    >
      <KeyDescription tag={tag} />
    </SearchQueryBuilderProvider>
  );
}

describe('KeyDescription', () => {
  it('describes the attribute and credits Sentry when Sentry defines it', () => {
    renderKeyDescription({key: 'release', name: 'release', kind: FieldKind.FIELD});

    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('The sentry release.')).toBeInTheDocument();
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
  });

  it('describes an unknown attribute as a tag and credits nobody', () => {
    renderKeyDescription({
      key: 'checkout.cart_size',
      name: 'checkout.cart_size',
      kind: FieldKind.TAG,
    });

    expect(screen.getByText('checkout.cart_size')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
    expect(screen.getByText('A tag sent with one or more events')).toBeInTheDocument();
    expect(screen.queryByText('Added by Sentry')).not.toBeInTheDocument();
  });

  it('credits nobody when the definition only types the attribute', () => {
    renderKeyDescription(
      {key: 'checkout.cart_size', name: 'checkout.cart_size', kind: FieldKind.TAG},
      (key, options) => getFieldDefinition(key, 'log', options?.kind)
    );

    expect(screen.getByText('string')).toBeInTheDocument();
    expect(screen.getByText('A tag sent with one or more events')).toBeInTheDocument();
    expect(screen.queryByText('Added by Sentry')).not.toBeInTheDocument();
  });

  it.each([
    ['a number attribute', {kind: FieldKind.MEASUREMENT}],
    ['a boolean attribute', {kind: FieldKind.BOOLEAN}],
    ['an array attribute', {kind: FieldKind.ARRAY}],
    ['a kindless tag', {}],
    [
      'a Sentry-sourced attribute',
      {kind: FieldKind.MEASUREMENT, attributeSource: 'sentry'},
    ],
    ['a Sentry-sourced tag', {kind: FieldKind.TAG, attributeSource: 'sentry'}],
    ['a Sentry field', {kind: FieldKind.FIELD}],
  ] as const)('describes %s generically when it has no description', (_, tag) => {
    renderKeyDescription({key: 'checkout.cart_size', name: 'checkout.cart_size', ...tag});

    expect(
      screen.getByText('An attribute sent with one or more events')
    ).toBeInTheDocument();
  });

  it('describes a kindless key generically when Sentry defines it without a description', () => {
    renderKeyDescription({key: 'project', name: 'project'});

    expect(
      screen.getByText('An attribute sent with one or more events')
    ).toBeInTheDocument();
  });

  it('types a feature flag as a boolean', () => {
    renderKeyDescription({
      key: 'flags["checkout.new-cart"]',
      name: 'flags["checkout.new-cart"]',
      kind: FieldKind.FEATURE_FLAG,
    });

    expect(screen.getByText('boolean')).toBeInTheDocument();
    expect(
      screen.getByText('A feature flag evaluated before an error event')
    ).toBeInTheDocument();
  });

  it('names an aggregate by its arguments', () => {
    renderKeyDescription(
      {key: 'count_unique', name: 'count_unique', kind: FieldKind.FUNCTION},
      key => getFieldDefinition(key, 'span')
    );

    expect(screen.getByText('count_unique(column)')).toBeInTheDocument();
    expect(screen.getByText('f(x)')).toBeInTheDocument();
    expect(screen.getByText('Unique count of the field values')).toBeInTheDocument();
  });
});
