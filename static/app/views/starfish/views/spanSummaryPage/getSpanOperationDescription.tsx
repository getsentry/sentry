import {t} from 'sentry/locale';

export function getSpanOperationDescription(spanOp: string) {
  if (spanOp?.startsWith('http')) {
    return t('URL Request');
  }

  if (spanOp === 'db.redis') {
    return t('Cache Query');
  }

  if (spanOp?.startsWith('db')) {
    return t('Database Query');
  }

  if (spanOp?.startsWith('task')) {
    return t('Application Task');
  }

  if (spanOp?.startsWith('serialize')) {
    return t('Serializer');
  }

  if (spanOp?.startsWith('middleware')) {
    return t('Middleware');
  }

  return t('Span');
}
