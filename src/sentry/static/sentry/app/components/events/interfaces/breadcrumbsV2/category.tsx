import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {defined} from 'app/utils';
import {t} from 'app/locale';

type Props = {
  category?: string | null;
};

const Category = ({category}: Props) => {
  const title = !defined(category) ? t('generic') : category;
  return (
    <Tooltip title={title}>
      <Wrapper title={title}>{title}</Wrapper>
    </Tooltip>
  );
};

export {Category};

const Wrapper = styled('div')`
  color: ${p => p.theme.gray5};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;
  line-height: 26px;
  ${overflowEllipsis};
`;
