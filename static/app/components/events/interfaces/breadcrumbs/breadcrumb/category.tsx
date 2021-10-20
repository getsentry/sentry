import {memo} from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import {t} from 'app/locale';
import {defined} from 'app/utils';

type Props = {
  searchTerm: string;
  category?: string | null;
};

const Category = memo(function Category({category, searchTerm}: Props) {
  const title = !defined(category) ? t('generic') : category;
  return (
    <Wrapper title={title}>
      <Highlight text={searchTerm}>{title}</Highlight>
    </Wrapper>
  );
});

export default Category;

const Wrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;
`;
