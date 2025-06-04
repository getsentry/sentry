import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Link, {type LinkProps} from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';

function ViewReplayLink({
  children,
  replayId,
  to,
}: {
  children: React.ReactNode;
  replayId: number | string;
  to: LinkProps['to'];
}) {
  const {replayExists} = useReplayExists();

  if (!replayId || !replayExists(String(replayId))) {
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
  color: ${p => p.theme.subText};
`;

export default ViewReplayLink;
