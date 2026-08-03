import styled from '@emotion/styled';

import {Link, type LinkProps} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {useReplayExists} from 'sentry/utils/replayCount/useReplayExists';

export function ViewReplayLink({
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
          'A replay ID was recorded, but the replay itself was never stored. It may have been sampled out, rate-limited, or deleted.'
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
