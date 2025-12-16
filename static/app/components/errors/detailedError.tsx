import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {getLastEventId} from 'sentry/bootstrap/initializeSdk';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconFlag} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  /**
   * Error heading
   */
  heading: React.ReactNode;
  className?: string;
  /**
   * Hide support links in footer of error message
   */
  hideSupportLinks?: boolean;
  /**
   * Detailed error explanation
   */
  message?: React.ReactNode;
  /**
   * Retry callback
   */
  onRetry?: (e: React.MouseEvent) => void;
};

function DetailedError({className, heading, message, onRetry, hideSupportLinks}: Props) {
  const showFooter = !!onRetry || !hideSupportLinks;
  const lastEventId = getLastEventId();

  return (
    <Wrapper className={className}>
      <ErrorHeading>
        <IconFlag size="md" color="errorText" />
        {heading}
      </ErrorHeading>

      {message}

      {showFooter && (
        <ErrorFooter>
          <div>{onRetry && <Button onClick={onRetry}>{t('Retry')}</Button>}</div>

          {!hideSupportLinks && (
            <ButtonBar gap="lg">
              {lastEventId && (
                <Button
                  priority="link"
                  onClick={e => {
                    e.preventDefault();
                    Sentry.showReportDialog({eventId: lastEventId});
                  }}
                >
                  {t('Fill out a report')}
                </Button>
              )}
              <LinkButton priority="link" external href="https://status.sentry.io/">
                {t('Service status')}
              </LinkButton>
              <LinkButton priority="link" external href="https://sentry.io/support/">
                {t('Contact support')}
              </LinkButton>
            </ButtonBar>
          )}
        </ErrorFooter>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin: ${space(2)} auto 0 auto;
  padding: ${space(2)};
  width: fit-content;
`;

const ErrorHeading = styled('h4')`
  display: flex;
  gap: ${space(1.5)};
  align-items: center;
  margin-left: calc(-1 * (${() => SvgIcon.ICON_SIZES.md} + ${space(1.5)}));
`;

const ErrorFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${space(2)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding-top: ${space(2)};
`;

export default DetailedError;
