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
    ['a number', FieldKind.MEASUREMENT],
    ['a boolean', FieldKind.BOOLEAN],
    ['an array', FieldKind.ARRAY],
    ['a kindless tag', undefined],
  ])('describes %s attribute generically', (_, kind) => {
    renderKeyDescription({key: 'checkout.cart_size', name: 'checkout.cart_size', kind});

    expect(
      screen.getByText('An attribute sent with one or more events')
    ).toBeInTheDocument();
  });

  it('describes a user attribute generically when its definition only types it', () => {
    renderKeyDescription(
      {
        key: 'checkout.cart_size',
        name: 'checkout.cart_size',
        kind: FieldKind.MEASUREMENT,
        attributeSource: 'user',
      },
      (key, options) => getFieldDefinition(key, 'log', options?.kind)
    );

    expect(
      screen.getByText('An attribute sent with one or more events')
    ).toBeInTheDocument();
  });

  it.each([
    [
      'a Sentry-sourced attribute',
      {key: 'checkout.cart_size', kind: FieldKind.MEASUREMENT, attributeSource: 'sentry'},
    ],
    [
      'a Sentry-sourced tag',
      {key: 'checkout.cart_size', kind: FieldKind.TAG, attributeSource: 'sentry'},
    ],
    ['a Sentry field', {key: 'checkout.cart_size', kind: FieldKind.FIELD}],
    ['a kindless key Sentry defines', {key: 'project'}],
  ] as const)('leaves %s undescribed when Sentry has no description', (_, tag) => {
    renderKeyDescription({name: tag.key, ...tag});

    expect(screen.queryByText('Description')).not.toBeInTheDocument();
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
