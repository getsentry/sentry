import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {getLastEventId} from 'sentry/bootstrap/initializeSdk';
import {IconFlag} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

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
        <IconFlag size="md" variant="danger" />
        {heading}
      </ErrorHeading>

      {message}

      {showFooter && (
        <ErrorFooter>
          <div>{onRetry && <Button onClick={onRetry}>{t('Retry')}</Button>}</div>

          {!hideSupportLinks && (
            <Grid flow="column" align="center" gap="lg">
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
            </Grid>
          )}
        </ErrorFooter>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin: ${p => p.theme.space.xl} auto 0 auto;
  padding: ${p => p.theme.space.xl};
  width: fit-content;
`;

const ErrorHeading = styled('h4')`
  display: flex;
  gap: ${p => p.theme.space.lg};
  align-items: center;
  margin-left: calc(-1 * (${() => SvgIcon.ICON_SIZES.md} + ${p => p.theme.space.lg}));
`;

const ErrorFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  padding-top: ${p => p.theme.space.xl};
`;

export default DetailedError;
