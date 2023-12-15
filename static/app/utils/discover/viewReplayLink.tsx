import {ComponentProps, ReactNode, ReactText} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';

function ViewReplayLink({
  children,
  replayId,
  to,
}: {
  children: ReactNode;
  replayId: ReactText | string;
  to: ComponentProps<typeof Link>['to'];
}) {
  const {replayExists} = useReplayExists();

  if (!replayExists(String(replayId))) {
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
