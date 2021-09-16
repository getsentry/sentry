import {BoundFunctions, FindAllByText, FindByText} from 'sentry-test/reactTestingLibrary';

// Taken from https://stackoverflow.com/a/56859650/1015027
function findTextWithMarkup(contentNode: null | Element, textMatch: string | RegExp) {
  const hasText = (node: Element) => node.textContent === textMatch;
  const nodeHasText = hasText(contentNode as Element);
  const childrenDontHaveText = Array.from(contentNode?.children || []).every(
    child => !hasText(child)
  );
  return nodeHasText && childrenDontHaveText;
}

/**
 * Search for a text broken up by multiple html elements
 * e.g.: <div>Hello <span>world</span></div>
 */
export function findByTextContent(
  screen: BoundFunctions<{findByText: FindByText}>,
  textMatch: string | RegExp
): Promise<HTMLElement> {
  return screen.findByText((_, contentNode) =>
    findTextWithMarkup(contentNode, textMatch)
  );
}

/**
 * Search for *all* texts broken up by multiple html elements
 * e.g.: <div><div>Hello <span>world</span></div><div>Hello <span>world</span></div></div>
 */
export function findAllByTextContent(
  screen: BoundFunctions<{findAllByText: FindAllByText}>,
  textMatch: string | RegExp
): Promise<HTMLElement[]> {
  return screen.findAllByText((_, contentNode) =>
    findTextWithMarkup(contentNode, textMatch)
  );
}
