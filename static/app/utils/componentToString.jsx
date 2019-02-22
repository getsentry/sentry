import ReactDOMServer from 'react-dom/server';

export function componentToString(node) {
  return ReactDOMServer.renderToStaticMarkup(node);
}
