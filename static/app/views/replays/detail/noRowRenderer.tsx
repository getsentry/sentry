import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  children: ReactNode;
  clearSearchTerm: () => void;
  unfilteredItems: unknown[];
};

function NoRowRenderer({children, unfilteredItems, clearSearchTerm}: Props) {
  return unfilteredItems.length === 0 ? (
    <StyledEmptyStateWarning>
      <p>{children}</p>
    </StyledEmptyStateWarning>
  ) : (
    <StyledEmptyStateWarning>
      <p>{t('No results found')}</p>
      <Button
        icon={<IconClose color="gray500" size="sm" isCircled />}
        onClick={clearSearchTerm}
        size="md"
      >
        {t('Clear filters')}
      </Button>
    </StyledEmptyStateWarning>
  );
}

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export default NoRowRenderer;
