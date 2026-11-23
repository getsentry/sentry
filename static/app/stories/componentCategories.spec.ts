import {COMPONENT_CATEGORY_ORDER, validateComponentCategory} from './componentCategories';

describe('validateComponentCategory', () => {
  it.each(COMPONENT_CATEGORY_ORDER)(
    'accepts the %s core component category',
    category => {
      expect(() =>
        validateComponentCategory('app/components/core/avatar/avatar.mdx', category)
      ).not.toThrow();
      expect(() =>
        validateComponentCategory('packages/scraps/src/button/button.mdx', category)
      ).not.toThrow();
    }
  );

  it.each([undefined, 'interaction', 'utilities', 'shared'])(
    'rejects the %s core component category',
    category => {
      expect(() =>
        validateComponentCategory('app/components/core/avatar/avatar.mdx', category)
      ).toThrow(
        'app/components/core/avatar/avatar.mdx has an invalid component category'
      );
      expect(() =>
        validateComponentCategory('packages/scraps/src/button/button.mdx', category)
      ).toThrow(
        'packages/scraps/src/button/button.mdx has an invalid component category'
      );
    }
  );

  it.each(['overview', 'patterns', 'principles'])(
    'allows %s documents to omit a category',
    section => {
      expect(() =>
        validateComponentCategory(`app/components/core/${section}/example.mdx`, undefined)
      ).not.toThrow();
    }
  );

  it('does not apply core category validation to other MDX files', () => {
    expect(() =>
      validateComponentCategory('app/components/featureShowcase.mdx', 'overlay')
    ).not.toThrow();
  });
});
