import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  processingErrors: readonly string[];
  className?: string;
}

export default function ReplayProcessingError({className, processingErrors}: Props) {
  useEffect(() => {
    Sentry.withScope(scope => {
      scope.setLevel('warning');
      scope.setFingerprint(['replay-processing-error']);
      processingErrors.forEach(error => {
        Sentry.metrics.increment(`replay.processing-error`, 1, {
          tags: {
            // There are only 2 different error types
            type:
              error.toLowerCase() === 'missing meta frame'
                ? 'missing-meta-frame'
                : 'insufficient-replay-frames',
          },
        });
      });
    });
  }, [processingErrors]);

  return (
    <StyledAlert type="error" showIcon className={className}>
      <Heading>{t('Replay Not Found')}</Heading>
      <p>{t('The replay you are looking for was not found.')}</p>
      <p>{t('The replay might be missing events or metadata.')}</p>
      <p>
        {t(
          'Or there may be an issue loading the actions from the server, click to try loading the Replay again.'
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
          {tct('If all else fails, [link:contact us] with more details', {
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
  margin: 0;
  height: 100%;
`;

const Heading = styled('h1')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.4;
  margin-bottom: ${space(1)};
`;
