// Taken from https://stackoverflow.com/a/56859650/1015027
function findTextWithMarkup(contentNode: null | Element, textMatch: string | RegExp) {
  const hasText = (node: Element): boolean => {
    if (node.textContent === null) {
      return false;
    }
    if (typeof textMatch === 'string') {
      return node.textContent.includes(textMatch);
    }
    return textMatch.test(node.textContent);
  };

  const nodeHasText = hasText(contentNode as Element);
  const childrenDontHaveText = Array.from(contentNode?.children || []).every(
    child => !hasText(child)
  );
  return nodeHasText && childrenDontHaveText;
}

/**
 * May be used with a *ByText RTL matcher to match text within multiple nodes
 *
 * e.g.: <div>Hello <span>world</span></div>
 */
export function textWithMarkupMatcher(textMatch: string | RegExp) {
  return function (_: string, element: Element | null) {
    return findTextWithMarkup(element, textMatch);
  };
}

/**
 * @deprecated  (This function is a workaround for test files that still use
 * enzyme.)
 *
 * Triggers onPress events on components that use react-aria (e.g. the
 * dropdown menu). These components require more complex events than what
 * enzyme can simulate with `.simulate('click')`. Preferably, we should use
 * the 'user-event' library from react testing library. Read more:
 * https://react-spectrum.adobe.com/react-spectrum/testing.html#triggering-events
 */
export function triggerPress(element) {
  element.prop('onClick')({
    button: 0,
    detail: 0,
    nativeEvent: {detail: 0},
    currentTarget: element.getDOMNode(),
    target: element.getDOMNode(),
    stopPropagation: () => {},
    preventDefault: () => {},
  });
}
