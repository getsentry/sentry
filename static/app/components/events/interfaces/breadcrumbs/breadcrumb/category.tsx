import {memo} from 'react';
import styled from '@emotion/styled';

import Highlight from 'sentry/components/highlight';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

type Props = {
  searchTerm: string;
  category?: string | null;
};

const Category = memo(function Category({category, searchTerm}: Props) {
  const title = defined(category) ? category : t('generic');
  return (
    <Wrapper title={title}>
      <Highlight text={searchTerm}>{title}</Highlight>
    </Wrapper>
  );
});

export default Category;

const Wrapper = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
