import {ReactNode} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  children: ReactNode;
  isLoading: boolean;
}

export default function FilterLoadingIndicator({children, isLoading}: Props) {
  return (
    <Wrapper>
      {children}
      {isLoading ? (
        <Tooltip title={t('Data is still loading')}>
          <LoadingIndicator mini />
        </Tooltip>
      ) : null}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;
