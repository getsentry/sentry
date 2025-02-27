import styled from '@emotion/styled';

import Tag, {Background} from 'sentry/components/core/badge/tag';
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
        <LevelTag type="error">
          <Highlight text={searchTerm}>{t('Fatal')}</Highlight>
        </LevelTag>
      );
    case BreadcrumbLevelType.ERROR:
      return (
        <LevelTag type="error">
          <Highlight text={searchTerm}>{t('Error')}</Highlight>
        </LevelTag>
      );
    case BreadcrumbLevelType.INFO:
      return (
        <LevelTag type="info">
          <Highlight text={searchTerm}>{t('Info')}</Highlight>
        </LevelTag>
      );
    case BreadcrumbLevelType.WARNING:
      return (
        <LevelTag type="warning">
          <Highlight text={searchTerm}>{t('Warning')}</Highlight>
        </LevelTag>
      );
    default:
      return (
        <LevelTag>
          <Highlight text={searchTerm}>{level || t('Undefined')}</Highlight>
        </LevelTag>
      );
  }
}

export default Level;

const LevelTag = styled(Tag)`
  display: flex;
  align-items: center;
  ${Background} {
    /** Same height as menu item labels, to prevent vertical cropping */
    height: calc(${p => p.theme.fontSizeMedium} * 1.4);
    overflow: hidden;
  }
`;
