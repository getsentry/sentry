import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/views/settings/components/tag';
import {t} from 'app/locale';
import {Color} from 'app/utils/theme';

import {BreadcrumbLevelType} from './types';

type Props = {
  level?: BreadcrumbLevelType;
};

const Level = React.memo(({level}: Props) => {
  switch (level) {
    case BreadcrumbLevelType.FATAL:
      return <StyledTag color="red500">{level}</StyledTag>;
    case BreadcrumbLevelType.ERROR:
      return <StyledTag color="red400">{level}</StyledTag>;
    case BreadcrumbLevelType.INFO:
      return <StyledTag color="blue400">{level}</StyledTag>;
    case BreadcrumbLevelType.WARNING:
      return <StyledTag color="orange400">{level}</StyledTag>;
    default:
      return <Tag>{level || t('undefined')}</Tag>;
  }
});

export default Level;

// TODO(style): Update the tag component with the new colors
const StyledTag = styled(Tag)<{color: Color}>`
  background-color: ${p => p.theme[p.color]};
  color: ${p => p.theme.white};
`;
