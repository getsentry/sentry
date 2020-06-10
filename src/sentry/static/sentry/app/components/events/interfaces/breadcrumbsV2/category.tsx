import React from 'react';
import styled from '@emotion/styled';

import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {defined} from 'app/utils';
import {t} from 'app/locale';

type Props = {
  category?: string | null;
};

const Category = React.memo(({category}: Props) => {
  const title = !defined(category) ? t('generic') : category;
  return (
    <Wrapper title={title}>
      <Tooltip title={title} containerDisplayMode="inline-flex">
        <TextOverflow>{title}</TextOverflow>
      </Tooltip>
    </Wrapper>
  );
});

export default Category;

const Wrapper = styled('div')`
  color: ${p => p.theme.gray800};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;
`;
