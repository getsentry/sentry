import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

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

function openFeedback(e: React.MouseEvent) {
  e.preventDefault();
  Sentry.showReportDialog();
}

function DetailedError({className, heading, message, onRetry, hideSupportLinks}: Props) {
  const showFooter = !!onRetry || !hideSupportLinks;
  const hasLastEvent = !!Sentry.lastEventId();

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
            <ButtonBar gap={1.5}>
              {hasLastEvent && (
                <Button priority="link" onClick={openFeedback}>
                  {t('Fill out a report')}
                </Button>
              )}
              <Button priority="link" external href="https://status.sentry.io/">
                {t('Service status')}
              </Button>
              <Button priority="link" external href="https://sentry.io/support/">
                {t('Contact support')}
              </Button>
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
  width: max-content;
`;

const ErrorHeading = styled('h4')`
  display: flex;
  gap: ${space(1.5)};
  align-items: center;
  margin-left: calc(-1 * (${p => p.theme.iconSizes.md} + ${space(1.5)}));
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
