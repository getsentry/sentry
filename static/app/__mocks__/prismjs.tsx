import prismComponents from 'prismjs/components';

const Prism = {
  manual: false,
  languages: Object.fromEntries(
    Object.keys(prismComponents.languages).map(language => [language, {}])
  ),
  tokenize: (code: string) => [code],
  highlightElement: () => {},
};

export default Prism;
