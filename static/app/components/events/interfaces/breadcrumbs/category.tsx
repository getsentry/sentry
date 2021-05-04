import {memo} from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {defined} from 'app/utils';

type Props = {
  searchTerm: string;
  category?: string | null;
};

const Category = memo(({category, searchTerm}: Props) => {
  const title = !defined(category) ? t('generic') : category;
  return (
    <Wrapper title={title}>
      <Tooltip title={title} containerDisplayMode="inline-flex">
        <TextOverflow>
          <Highlight text={searchTerm}>{title}</Highlight>
        </TextOverflow>
      </Tooltip>
    </Wrapper>
  );
});

export default Category;

const Wrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;
`;
