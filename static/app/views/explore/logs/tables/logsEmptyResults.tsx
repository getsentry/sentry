import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {FileSize} from 'sentry/components/fileSize';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TableStatus} from 'sentry/views/explore/components/table';
import {LOGS_INSTRUCTIONS_URL} from 'sentry/views/explore/logs/constants';
import {EmptyStateText} from 'sentry/views/explore/tables/tracesTable/styles';

interface LogsEmptyResultsProps {
  analyticsPageSource: LogsAnalyticsPageSource;
  bytesScanned?: number;
  canResumeAutoFetch?: boolean;
  resumeAutoFetch?: () => void;
}

export function LogsEmptyResults({
  bytesScanned,
  canResumeAutoFetch,
  analyticsPageSource,
  resumeAutoFetch,
}: LogsEmptyResultsProps) {
  const organization = useOrganization();

  if (bytesScanned && canResumeAutoFetch && resumeAutoFetch) {
    return (
      <TableStatus>
        <EmptyStateWarning withIcon variant="accent">
          <EmptyStateText size="xl">{t('No logs found yet')}</EmptyStateText>
          <EmptyStateText size="md">
            {tct(
              'We scanned [bytesScanned] so far but have not found anything matching your filters',
              {bytesScanned: <FileSize bytes={bytesScanned} base={2} />}
            )}
          </EmptyStateText>
          <EmptyStateText size="md">
            {t('We can keep digging or you can narrow down your search.')}
          </EmptyStateText>
          <Container paddingTop="md">
            <Button
              priority="default"
              onClick={() => {
                trackAnalytics('logs.explorer.continue_searching_clicked', {
                  bytes_scanned: bytesScanned,
                  organization,
                  page_source: analyticsPageSource,
                });
                resumeAutoFetch();
              }}
              aria-label={t('continue scanning')}
            >
              {t('Continue Scanning')}
            </Button>
          </Container>
        </EmptyStateWarning>
      </TableStatus>
    );
  }

  return (
    <TableStatus>
      <EmptyStateWarning withIcon variant="accent">
        <EmptyStateText size="xl">{t('No logs found')}</EmptyStateText>
        <EmptyStateText size="md">
          {tct(
            'Try adjusting your filters or get started with sending logs by checking these [instructions].',
            {
              instructions: (
                <ExternalLink href={LOGS_INSTRUCTIONS_URL}>
                  {t('instructions')}
                </ExternalLink>
              ),
            }
          )}
        </EmptyStateText>
      </EmptyStateWarning>
    </TableStatus>
  );
}
