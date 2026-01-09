import styled from '@emotion/styled';

import {Link, type LinkProps} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';

function ViewReplayLink({
  children,
  replayId,
  to,
  start,
  end,
}: {
  children: React.ReactNode;
  replayId: number | string;
  to: LinkProps['to'];
  end?: string;
  start?: string;
}) {
  const {replayExists} = useReplayExists({start, end});

  if (!replayId || !replayExists(String(replayId))) {
    return (
      <Tooltip
        title={t(
          'This replay may been rate-limited, deleted, or not stored due to the error-based replay sampling rate.'
        )}
      >
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
  color: ${p => p.theme.tokens.content.secondary};
`;

export default ViewReplayLink;
