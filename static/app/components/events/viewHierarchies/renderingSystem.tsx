import {t} from 'sentry/locale';

function RenderingSystem({system}) {
  // TODO: i18n "Rendering System"
  return <div>Rendering System: {system ?? t('Unknown')}</div>;
}

export {RenderingSystem};
