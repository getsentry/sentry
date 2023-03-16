import localStorage from 'sentry/utils/localStorage';

const SHOW_TEMPLATES_KEY = 'dashboards-show-templates';

export function shouldShowTemplates(): boolean {
  const shouldShow = localStorage.getItem(SHOW_TEMPLATES_KEY);
  return shouldShow === 'true' || shouldShow === null;
}
export function setShowTemplates(value: boolean) {
  localStorage.setItem(SHOW_TEMPLATES_KEY, value ? 'true' : 'false');
}
