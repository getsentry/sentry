import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import type {ReplayReader} from 'sentry/utils/replays/replayReader';

interface Props {
  replay: ReplayReader | null;
  className?: string;
}

export function ReplayProcessingError({className, replay}: Props) {
  const {sdk} = replay?.getReplay() || {};
  const processingErrors = replay?.processingErrors();
  const hasReported = useRef(false);

  useEffect(() => {
    // The reader is rebuilt as attachment pages settle, so this can run more
    // than once for a single view. Report the replay once instead.
    if (hasReported.current) {
      return;
    }
    hasReported.current = true;

    Sentry.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['replay-processing-error']);
      if (sdk) {
        scope.setTag('sdk.version', sdk.version);
      }
      scope.setExtra('processingErrors', processingErrors);
      Sentry.captureMessage('Replay processing error');
    });
  }, [processingErrors, sdk]);

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
