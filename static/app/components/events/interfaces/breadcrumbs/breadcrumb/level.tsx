import {memo} from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import Tag, {Background} from 'app/components/tag';
import {t} from 'app/locale';
import {BreadcrumbLevelType} from 'app/types/breadcrumbs';

type Props = {
  level: BreadcrumbLevelType;
  searchTerm?: string;
};

const Level = memo(function Level({level, searchTerm = ''}: Props) {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
      return (
        <StyledTag type="error">
          <Highlight text={searchTerm}>{t('Fatal')}</Highlight>
        </StyledTag>
      );
    case BreadcrumbLevelType.ERROR:
      return (
        <StyledTag type="error">
          <Highlight text={searchTerm}>{t('Error')}</Highlight>
        </StyledTag>
      );
    case BreadcrumbLevelType.INFO:
      return (
        <StyledTag type="info">
          <Highlight text={searchTerm}>{t('Info')}</Highlight>
        </StyledTag>
      );
    case BreadcrumbLevelType.WARNING:
      return (
        <StyledTag type="warning">
          <Highlight text={searchTerm}>{t('Warning')}</Highlight>
        </StyledTag>
      );
    default:
      return (
        <StyledTag>
          <Highlight text={searchTerm}>{level || t('Undefined')}</Highlight>
        </StyledTag>
      );
  }
});

export default Level;

const StyledTag = styled(Tag)`
  ${Background} {
    overflow: hidden;
  }
`;
