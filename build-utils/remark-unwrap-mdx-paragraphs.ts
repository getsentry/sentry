import type {Node, Literal, Parent} from 'hast';

import {visit} from 'unist-util-visit';

/**
 * Remark plugin that unwraps paragraphs with only JSX elements and paragraphs inside MDX components
 *
 * - Find paragraphs that only contain MDX JSX text and/or whitespace, replace with children
 * - Find paragraphs that are the only children of MDX JSX elements, replace with children
 *
 */
export function remarkUnwrapMdxParagraphs() {
  return function (tree: Node) {
    // unwrap paragraphs with only JSX text and whitespace
    visit(tree, (node, index, parent: Parent) => {
      if (isParagraph(node)) {
        const hasOnlyJsxAndWhitespace = node.children.every(child => {
          switch (true) {
            case child.type === 'mdxJsxTextElement':
              return true;
            case isText(child):
              // Allow only whitespace text nodes
              return child.value.trim() === '';
            default:
              return false;
          }
        });
        if (hasOnlyJsxAndWhitespace && parent && index !== undefined) {
          // replace paragraph with its children
          parent.children.splice(index, 1, ...node.children);
          // return new index
          return index + node.children.length - 1;
        }
      }
      return;
    });
    // unwrap paragraphs that are only children of MDX JSX elements
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], node => {
      if (!isMdxJsxNode(node)) {
        return;
      }
      const [child, ...rest] = node.children;
      // only child is a paragraph
      if (rest.length === 0 && isParagraph(child)) {
        // replace paragraph with its children
        node.children.splice(0, 1, ...child.children);
        // return new index
        return child.children.length - 1;
      }
      return;
    });
  };
}

function isParagraph(node?: Node): node is Parent {
  return node?.type === 'paragraph';
}
function isText(node: Node): node is Literal {
  return node.type === 'text';
}
function isMdxJsxNode(node: Node): node is Parent {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement';
}
