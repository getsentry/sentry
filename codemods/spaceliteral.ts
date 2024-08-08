// npx jscodeshift --ignore-config=".gitignore" --ignore-pattern="**/node_modules/**" -t codemods/spaceliteral.ts ./**/*.tsx --parser=babel
import type {API, ASTNode, CallExpression, FileInfo, TemplateLiteral} from 'jscodeshift';

function isStyleCallExpression(path: CallExpression) {
  return (
    path.callee.type === 'Identifier' &&
    path.callee.name === 'space' &&
    path.arguments.length === 1 &&
    path.arguments[0].type === 'Literal'
  );
}

function parentIsTemplateLiteral(parent: ASTNode): parent is TemplateLiteral {
  return parent.type === 'TemplateLiteral';
}

function styledArgv(node: CallExpression): string {
  const argv = node.arguments[0];
  if (argv.type === 'Literal') {
    return String(argv.value);
  }
  throw new Error('Invalid argv');
}

export default function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;

  return j(file.source)
    .find(j.CallExpression)
    .forEach(path => {
      if (
        isStyleCallExpression(path.value) &&
        parentIsTemplateLiteral(path.parent.value)
      ) {
        j(path).replaceWith(`p => p.theme.space(${styledArgv(path.value)})`);
      }
    })
    .toSource();
}
