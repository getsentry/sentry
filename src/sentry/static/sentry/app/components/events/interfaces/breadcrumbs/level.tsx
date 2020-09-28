import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Highlight from 'app/components/highlight';
import Tag from 'app/components/tag';
import {Color} from 'app/utils/theme';

import {BreadcrumbLevelType} from './types';

type Props = {
  level: BreadcrumbLevelType;
  searchTerm?: string;
};

const Level = React.memo(({level, searchTerm = ''}: Props) => {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
      return (
        <StyledTag color="red500">
          <Highlight text={searchTerm}>{t('fatal')}</Highlight>
        </StyledTag>
      );
    case BreadcrumbLevelType.ERROR:
      return (
        <StyledTag color="red400">
          <Highlight text={searchTerm}>{t('error')}</Highlight>
        </StyledTag>
      );
    case BreadcrumbLevelType.INFO:
      return (
        <StyledTag color="blue400">
          <Highlight text={searchTerm}>{t('info')}</Highlight>
        </StyledTag>
      );
    case BreadcrumbLevelType.WARNING:
      return (
        <StyledTag color="orange400">
          <Highlight text={searchTerm}>{t('warning')}</Highlight>
        </StyledTag>
      );
    default:
      return (
        <Tag>
          <Highlight text={searchTerm}>{level || t('undefined')}</Highlight>
        </Tag>
      );
  }
});

export default Level;

// TODO(style): Update the tag component with the new colors
const StyledTag = styled(Tag)<{color: Color}>`
  background-color: ${p => p.theme[p.color]};
  color: ${p => p.theme.white};
`;
