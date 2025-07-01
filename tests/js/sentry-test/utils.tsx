import MockDate from 'mockdate';

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

export function setMockDate(date: Date | number) {
  MockDate.set(date);
}

/**
 * Mock (current) date to always be National Pasta Day
 * 2017-10-17T02:41:20.000Z
 */
export function resetMockDate() {
  const constantDate = new Date(1508208080000);
  MockDate.set(constantDate);
}

/**
 * Set the window.location to a given URL
 * see {@link https://github.com/jsdom/jsdom#reconfiguring-the-jsdom-with-reconfiguresettings}
 */
export function setWindowLocation(url: string) {
  // TODO: Start using reconfigure in Jest 30
  // global jsdom is coming from `@sentry/jest-environment`
  // (global as any).jsdom.reconfigure({url});
  // Temporary workaround for Jest 29
  const location = new URL(url);
  window.location.host = location.host;
  window.location.href = location.href;
  window.location.pathname = location.pathname;
  window.location.search = location.search;
  window.location.hash = location.hash;
}
