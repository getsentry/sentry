import {memo} from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {defined} from 'app/utils';

type Props = {
  searchTerm: string;
  category?: string | null;
};

function Category({category, searchTerm}: Props) {
  const title = !defined(category) ? t('generic') : category;
  return (
    <Wrapper>
      <Tooltip title={title} containerDisplayMode="inline-flex">
        <Highlight text={searchTerm}>{title}</Highlight>
      </Tooltip>
    </Wrapper>
  );
}

export default memo(Category);

const Wrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;
`;
