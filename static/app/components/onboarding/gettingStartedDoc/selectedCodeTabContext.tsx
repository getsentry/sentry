/**
 * Registration-based store for tracking selected code tabs across
 * onboarding code snippets.
 *
 * Each TabbedCodeSnippet registers a getter via useEffect on mount.
 * Registration order matches React render order (tree-order, depth-first),
 * which aligns with the order stepsToMarkdown iterates content blocks.
 * This lets us do positional matching without keys or labels.
 */

type TabSelectionGetter = () => string;

const _registrations: TabSelectionGetter[] = [];

/**
 * Register a getter that returns the currently selected tab label.
 * Called by TabbedCodeSnippet on mount. Returns a cleanup function
 * that removes the registration on unmount.
 */
export function registerTabSelection(getter: TabSelectionGetter): () => void {
  _registrations.push(getter);
  return () => {
    const idx = _registrations.indexOf(getter);
    if (idx !== -1) {
      _registrations.splice(idx, 1);
    }
  };
}

/**
 * Collect all current tab selections in registration (render) order.
 * Called by OnboardingCopyMarkdownButton at click time.
 */
export function getTabSelections(): string[] {
  return _registrations.map(fn => fn());
}
