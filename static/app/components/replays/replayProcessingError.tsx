import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type {ReplayReader} from 'sentry/utils/replays/replayReader';

interface Props {
  className?: string;
  /**
   * Pass the replay when rendering outside `ReplayReaderProvider`, such as in
   * issue previews and loading states.
   */
  replay?: ReplayReader | null;
}

/**
 * Copy for errors that only break the player. Returns null when the replay has
 * nothing else to show, so the generic Replay Not Found message is used.
 */
function getPlayerOnlyError(replay: ReplayReader | null) {
  if (!replay?.hasTimelineData()) {
    return null;
  }
  if (replay.isMissingFullSnapshot()) {
    return {
      heading: t('No Screen Recording'),
      reason: t(
        'The SDK sent events for this replay but never captured the page itself, so there is nothing to play back.'
      ),
    };
  }
  if (replay.isMissingMeta()) {
    return {
      heading: t('Recording Cannot Be Played'),
      reason: t(
        'The SDK captured the page but not the screen size it was shown at, so the recording cannot be played back.'
      ),
    };
  }
  return null;
}

export function ReplayProcessingError({className, replay: replayProp}: Props) {
  const contextReplay = useReplayReader();
  const replay = replayProp ?? contextReplay;
  const {sdk} = replay?.getReplay() || {};

  useEffect(() => {
    const errors = replay?.processingErrors() ?? [];
    if (!errors.length) {
      return;
    }
    Sentry.logger.warn('Replay: processing error', {
      replayId: replay?.getReplay()?.id,
      errors: errors.join(', '),
      sdkName: sdk?.name ?? 'unknown',
      sdkVersion: sdk?.version ?? 'unknown',
    });
  }, [replay, sdk]);

  const playerOnlyError = getPlayerOnlyError(replay);

  if (playerOnlyError) {
    return (
      <StyledAlert variant="info" className={className}>
        <Heading>{playerOnlyError.heading}</Heading>
        <p>{playerOnlyError.reason}</p>
        {replay?.isVideoReplay() ? null : (
          <p>
            {tct(
              'See the [link:Session Replay troubleshooting docs] for common causes and fixes.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/troubleshooting/" />
                ),
              }
            )}
          </p>
        )}
        <p>{t('Other information captured for this replay is still available.')}</p>
      </StyledAlert>
    );
  }

  return (
    <StyledAlert variant="info" className={className}>
      <Heading>{t('Replay Not Found')}</Heading>
      <p>
        {t('The replay you are looking for was not found due to a processing error.')}
      </p>
      <p>
        {t(
          'The replay might be missing critical events or metadata, or there may be an issue loading the actions from the server.'
        )}
      </p>
      <ul>
        <li>
          {t(
            `If you followed a link here, try hitting back and reloading the
           page. It's possible the resource was moved out from under you.`
          )}
        </li>
        <li>
          {tct('If all else fails, feel free to [link:contact us] with more details.', {
            link: (
              <ExternalLink href="https://github.com/getsentry/sentry/issues/new/choose" />
            ),
          })}
        </li>
      </ul>
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  height: 100%;
`;

const Heading = styled('h1')`
  font-size: ${p => p.theme.font.size.lg};
  line-height: 1.4;
  margin-bottom: ${p => p.theme.space.md};
`;
