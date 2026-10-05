import {
  COMPONENT_CATEGORY_ORDER,
  validateComponentCategory,
} from 'sentry/stories/componentCategories';

describe('validateComponentCategory', () => {
  it.each(COMPONENT_CATEGORY_ORDER)(
    'accepts the %s core component category',
    category => {
      expect(() =>
        validateComponentCategory('components/core/button/button.mdx', category)
      ).not.toThrow();
    }
  );

  it.each([undefined, 'interaction', 'utilities', 'shared'])(
    'rejects the %s core component category',
    category => {
      expect(() =>
        validateComponentCategory('components/core/button/button.mdx', category)
      ).toThrow('components/core/button/button.mdx has an invalid component category');
    }
  );

  it.each(['overview', 'patterns', 'principles'])(
    'allows %s documents to omit a category',
    section => {
      expect(() =>
        validateComponentCategory(`components/core/${section}/example.mdx`, undefined)
      ).not.toThrow();
    }
  );

  it('does not apply core category validation to other MDX files', () => {
    expect(() =>
      validateComponentCategory('components/featureShowcase.mdx', 'overlay')
    ).not.toThrow();
  });
});
