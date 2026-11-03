import Prism from 'prismjs';

import {getPrismLanguage, loadPrismLanguage} from './prism';

describe('Prism language loading', () => {
  it('resolves aliases without changing unknown languages into a grammar', () => {
    expect(getPrismLanguage('TSX?')).toBe('tsx');
    expect(getPrismLanguage('rs')).toBe('rust');
    expect(getPrismLanguage('text')).toBeUndefined();
  });

  it('loads a non-default grammar and its transitive dependencies', async () => {
    const onLoad = jest.fn();
    const onError = jest.fn();

    await loadPrismLanguage('tsx', {onLoad, onError});

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(Prism.languages.jsx).toBeDefined();
    expect(Prism.languages.typescript).toBeDefined();
    expect(
      Prism.highlight('const element = <Button />;', Prism.languages.tsx!, 'tsx')
    ).toContain('token tag');
  });

  it('reports unsupported grammars while leaving plain text available', async () => {
    const onLoad = jest.fn();
    const onError = jest.fn();
    await loadPrismLanguage('unsupported-language', {
      onLoad,
      onError,
      suppressExistenceWarning: true,
    });

    expect(onLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
