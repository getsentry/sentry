/**
 * Removes any theme class from the body element.
 *
 * These classes are added in base-react.html to avoid white flash when
 * the page loads in dark mode before the app is loaded.
 */
export const removeBodyTheme = (): void => {
  document.body.classList.remove('theme-light', 'theme-dark', 'theme-system');
};
