import {ComponentProps, ReactNode, ReactText, useContext} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';

function ViewReplayLink({
  children,
  replayId,
  to,
}: {
  children: ReactNode;
  replayId: ReactText | string;
  to: ComponentProps<typeof Link>['to'];
}) {
  const count = useContext(ReplayCountContext)[replayId] || 0;

  if (count < 1) {
    return (
      <Tooltip title={t('This replay may have been rate limited or deleted.')}>
        <EmptyValueContainer>{t('(missing)')}</EmptyValueContainer>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={t('View Replay')}>
      <StyledLink to={to}>{children}</StyledLink>
    </Tooltip>
  );
}

const StyledLink = styled(Link)`
  & div {
    display: inline;
  }
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

export default ViewReplayLink;
