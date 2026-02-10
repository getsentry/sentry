/**
 * Simple module-level store for tracking the currently selected code tab
 * (e.g. "npm", "yarn", "pnpm") across onboarding code snippets.
 *
 * Avoids React context so consumers don't need a wrapping provider,
 * keeping diffs minimal when adding the Copy as Markdown button.
 */

let _selectedTab: string | null = null;

export function getSelectedCodeTab(): string | null {
  return _selectedTab;
}

export function setSelectedCodeTab(tab: string): void {
  _selectedTab = tab;
}
