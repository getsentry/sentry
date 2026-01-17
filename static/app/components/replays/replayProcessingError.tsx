import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

interface Props {
  className?: string;
}

export default function ReplayProcessingError({className}: Props) {
  const replay = useReplayReader();
  const {sdk} = replay?.getReplay() || {};

  useEffect(() => {
    Sentry.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['replay-processing-error']);
      if (sdk) {
        scope.setTag('sdk.version', sdk.version);
      }
    });
  }, [sdk]);

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
  font-size: ${p => p.theme.fontSize.lg};
  line-height: 1.4;
  margin-bottom: ${space(1)};
`;
