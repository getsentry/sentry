import type {TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';
import {TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

import {filterTreemapElement} from './treemapFiltering';

describe('filterTreemapElement', () => {
  const createMockElement = (
    name: string,
    children: TreemapElement[] = []
  ): TreemapElement => ({
    name,
    size: 100,
    is_dir: children.length > 0,
    type: TreemapType.FILES,
    children,
    path: name,
    flagged_insights: [],
  });

  it('returns original element when no search query', () => {
    const element = createMockElement('root', [
      createMockElement('child1'),
      createMockElement('child2'),
    ]);

    const result = filterTreemapElement(element, '');
    expect(result).toBe(element);
  });

  it('filters elements by name', () => {
    const element = createMockElement('root', [
      createMockElement('match.js'),
      createMockElement('different.css'),
    ]);

    const result = filterTreemapElement(element, 'match');
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('match.js');
  });

  it('includes parent when child matches', () => {
    const element = createMockElement('root', [
      createMockElement('parent', [
        createMockElement('match.js'),
        createMockElement('different.css'),
      ]),
    ]);

    const result = filterTreemapElement(element, 'match');
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('parent');
    expect(result?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.name).toBe('match.js');
  });

  it('includes all children when parent matches (regular search)', () => {
    const element = createMockElement('root', [
      createMockElement('sentry', [
        createMockElement('component1.js'),
        createMockElement('component2.js'),
        createMockElement('utils.js'),
      ]),
      createMockElement('other', [createMockElement('file.js')]),
    ]);

    const result = filterTreemapElement(element, 'sentry');
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('sentry');
    // Should include ALL children of the matching parent
    expect(result?.children[0]?.children).toHaveLength(3);
    expect(result?.children[0]?.children.map(c => c.name)).toEqual([
      'component1.js',
      'component2.js',
      'utils.js',
    ]);
  });

  it('filters children when using exact search with double backticks', () => {
    const element = createMockElement('root', [
      createMockElement('sentry', [
        createMockElement('component1.js'),
        createMockElement('component2.js'),
        createMockElement('utils.js'),
      ]),
      createMockElement('other', [createMockElement('file.js')]),
    ]);

    const result = filterTreemapElement(element, '`sentry`');
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('sentry');
    // With exact search, should filter children recursively (none match 'sentry')
    expect(result?.children[0]?.children).toHaveLength(0);
  });

  it('handles path-based searching in nested structure', () => {
    const element = createMockElement('root', [
      createMockElement('src', [
        createMockElement('components', [createMockElement('button.js')]),
        createMockElement('utils', [createMockElement('helper.js')]),
      ]),
    ]);

    const result = filterTreemapElement(element, 'src/comp/button');
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('src');
    expect(result?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.name).toBe('components');
    expect(result?.children[0]?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.children[0]?.name).toBe('button.js');
  });

  it('returns null when no matches found', () => {
    const element = createMockElement('root', [
      createMockElement('nomatch1.js'),
      createMockElement('nomatch2.css'),
    ]);

    const result = filterTreemapElement(element, 'nonexistent');
    expect(result).toBeNull();
  });

  it('regular search - should only return matching children', () => {
    const element = createMockElement('root', [
      createMockElement('match.js'),
      createMockElement('different.css'),
      createMockElement('another-match.ts'),
    ]);

    const result = filterTreemapElement(element, 'match');
    expect(result?.children).toHaveLength(2);
    expect(result?.children.map(c => c.name)).toEqual(['match.js', 'another-match.ts']);
  });

  it('regular search - should include all children when parent directory matches', () => {
    const element = createMockElement('root', [
      createMockElement('sentry-folder', [
        createMockElement('component1.js'),
        createMockElement('component2.js'),
        createMockElement('utils.js'),
      ]),
      createMockElement('other-folder', [createMockElement('file.js')]),
    ]);

    const result = filterTreemapElement(element, 'sentry');
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('sentry-folder');
    // When parent matches, should include ALL its children
    expect(result?.children[0]?.children).toHaveLength(3);
    expect(result?.children[0]?.children.map(c => c.name)).toEqual([
      'component1.js',
      'component2.js',
      'utils.js',
    ]);
  });

  it('searching HackerNews should only return HackerNews related nodes', () => {
    const element = createMockElement('root', [
      createMockElement('App', [
        createMockElement('HackerNews.framework', [
          createMockElement('HackerNews'),
          createMockElement('Info.plist'),
        ]),
        createMockElement('SomeOtherFramework', [createMockElement('OtherFile')]),
      ]),
      createMockElement('Libraries', [
        createMockElement('libHackerNews.a'),
        createMockElement('libOther.a'),
      ]),
      createMockElement('Resources', [
        createMockElement('image.png'),
        createMockElement('HackerNewsIcon.png'),
      ]),
    ]);

    const result = filterTreemapElement(element, 'HackerNews');

    // Should only include nodes that match or contain matching children
    expect(result?.children).toHaveLength(3); // App, Libraries, Resources

    // App folder should only contain HackerNews.framework
    expect(result?.children[0]?.name).toBe('App');
    expect(result?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.name).toBe('HackerNews.framework');

    // Libraries folder should only contain libHackerNews.a
    expect(result?.children[1]?.name).toBe('Libraries');
    expect(result?.children[1]?.children).toHaveLength(1);
    expect(result?.children[1]?.children[0]?.name).toBe('libHackerNews.a');

    // Resources folder should only contain HackerNewsIcon.png
    expect(result?.children[2]?.name).toBe('Resources');
    expect(result?.children[2]?.children).toHaveLength(1);
    expect(result?.children[2]?.children[0]?.name).toBe('HackerNewsIcon.png');
  });

  it('filters to matching nodes only', () => {
    const element = createMockElement('root', [
      createMockElement('Payload', [
        createMockElement('Applications', [
          createMockElement('HackerNews.app', [createMockElement('Contents')]),
        ]),
      ]),
      createMockElement('Frameworks', [
        createMockElement('SomeFramework.framework', [createMockElement('SomeFile')]),
      ]),
    ]);

    const result = filterTreemapElement(element, 'HackerNews');

    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('Payload');
    expect(result?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.name).toBe('Applications');
    expect(result?.children[0]?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.children[0]?.name).toBe('HackerNews.app');
  });

  it('excludes unrelated top-level nodes', () => {
    const element = createMockElement('root', [
      createMockElement('Assets.car'),
      createMockElement('HackerNews', [
        createMockElement('__TEXT'),
        createMockElement('__cstring'),
        createMockElement('SwiftSoup'),
      ]),
      createMockElement('SwiftSoup', [
        createMockElement('Element'),
        createMockElement('Html'),
      ]),
      createMockElement('Swift'),
      createMockElement('Plugins', [
        createMockElement('HackerNewsHomeWidgetExtension.appex'),
      ]),
      createMockElement('Frameworks', [createMockElement('Common.framework')]),
    ]);

    const result = filterTreemapElement(element, 'HackerNews');

    expect(result?.children?.length).toBe(2);
    expect(result?.children?.map(c => c.name)).toEqual(['HackerNews', 'Plugins']);
    expect(result?.children?.find(c => c.name === 'SwiftSoup')).toBeUndefined();
    expect(result?.children?.find(c => c.name === 'Assets.car')).toBeUndefined();
  });

  it('filters children of app containers when app name matches search', () => {
    const result = filterTreemapElement(
      createMockElement('HackerNews.app', [
        createMockElement('Contents', [
          createMockElement('Frameworks', [
            createMockElement('SomeUnrelatedFramework.framework'),
          ]),
          createMockElement('Resources', [createMockElement('unrelated-icon.png')]),
        ]),
      ]),
      'HackerNews',
      '/Applications'
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe('HackerNews.app');
    expect(result?.children).toHaveLength(0);
  });

  it('filters app container children when using root filtering', () => {
    const element = createMockElement('root', [
      createMockElement('Applications', [
        createMockElement('HackerNews.app', [
          createMockElement('Contents', [
            createMockElement('Frameworks', [
              createMockElement('SomeUnrelatedFramework.framework'),
            ]),
            createMockElement('Resources', [createMockElement('unrelated-icon.png')]),
          ]),
        ]),
      ]),
    ]);

    const result = filterTreemapElement(element, 'HackerNews', '');

    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.name).toBe('Applications');
    expect(result?.children[0]?.children).toHaveLength(1);
    expect(result?.children[0]?.children[0]?.name).toBe('HackerNews.app');
    expect(result?.children[0]?.children[0]?.children).toHaveLength(0);
  });

  it('returns null when searching for completely non-existent terms', () => {
    const element = createMockElement('root', [
      createMockElement('App', [
        createMockElement('HackerNews.app', [
          createMockElement('Contents', [createMockElement('Frameworks')]),
        ]),
      ]),
      createMockElement('Libraries', [createMockElement('libSomething.a')]),
    ]);

    const result = filterTreemapElement(element, 'asdfghijklskdjfgjsdjfgjsdjfgjkslkfgj');
    expect(result).toBeNull();
  });
});
