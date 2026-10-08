import prismComponents from 'prismjs/components';

const escapeHtml = (code: string) =>
  code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const Prism = {
  manual: false,
  languages: Object.keys(prismComponents.languages).reduce(
    (acc, language) => ({...acc, [language]: {}}),
    {}
  ),
  tokenize: (code: string) => [code],
  // Real Prism.highlight escapes the source and wraps tokens in spans; the mock
  // grammars produce no tokens, so escaping alone mirrors the un-tokenized output
  // the tests rely on.
  highlight: (code: string) => escapeHtml(code),
  highlightElement: () => {},
  hooks: {
    add: () => {},
    run: () => {},
  },
};

export default Prism;
