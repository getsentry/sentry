import {Tag} from 'sentry/components/core/badge/tag';
import Highlight from 'sentry/components/highlight';
import {t} from 'sentry/locale';
import {BreadcrumbLevelType} from 'sentry/types/breadcrumbs';

type Props = {
  level: BreadcrumbLevelType;
  searchTerm?: string;
};

export function Level({level, searchTerm = ''}: Props) {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
      return (
        <Tag variant="danger">
          <Highlight text={searchTerm}>{t('Fatal')}</Highlight>
        </Tag>
      );
    case BreadcrumbLevelType.ERROR:
      return (
        <Tag variant="danger">
          <Highlight text={searchTerm}>{t('Error')}</Highlight>
        </Tag>
      );
    case BreadcrumbLevelType.INFO:
      return (
        <Tag variant="info">
          <Highlight text={searchTerm}>{t('Info')}</Highlight>
        </Tag>
      );
    case BreadcrumbLevelType.WARNING:
      return (
        <Tag variant="warning">
          <Highlight text={searchTerm}>{t('Warning')}</Highlight>
        </Tag>
      );
    default:
      return (
        <Tag>
          <Highlight text={searchTerm}>{level || t('Undefined')}</Highlight>
        </Tag>
      );
  }
}
