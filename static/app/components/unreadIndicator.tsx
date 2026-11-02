import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

export function UnreadIndicator(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Tooltip title={t('Unread')} skipWrapper>
      <Dot {...props} />
    </Tooltip>
  );
}

const Dot = styled('div')`
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;
