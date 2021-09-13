import {BoundFunctions, FindByText} from 'sentry-test/reactTestingLibrary';

/**
 * Search for a text broken up by multiple html elements
 * e.g.: <div>Hello <span>world</span></div>
 */
export function findByTextContent(
  screen: BoundFunctions<{findByText: FindByText}>,
  textMatch: string | RegExp
): Promise<HTMLElement> {
  return screen.findByText((_, contentNode) => {
    const hasText = (node: Element) => node.textContent === textMatch;
    const nodeHasText = hasText(contentNode as Element);
    const childrenDontHaveText = Array.from(contentNode?.children || []).every(
      child => !hasText(child)
    );
    return nodeHasText && childrenDontHaveText;
  });
}
