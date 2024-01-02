import prismComponents from 'prismjs/components';

const Prism = {
  manual: false,
  languages: Object.keys(prismComponents.languages).reduce(
    (acc, language) => ({...acc, [language]: {}}),
    {}
  ),
  tokenize: (code: string) => [code],
  highlightElement: () => {},
};

export default Prism;
