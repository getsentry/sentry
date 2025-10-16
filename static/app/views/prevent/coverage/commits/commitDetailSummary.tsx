import {Fragment} from 'react';

import {Grid} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {SummaryCard, SummaryCardGroup} from 'sentry/components/prevent/summary';
import {t, tct} from 'sentry/locale';

const headCommit = {
  sha: '31b72ff64bd75326ea5e43bf8e93b415db56cb62',
  shortSha: '31b72ff',
};

const baseCommit = {
  sha: 'da46d4c13e4a75b7624c8c6763816ecb6dad1968',
  shortSha: 'da46d4c',
};

export function CommitDetailSummary() {
  return (
    <Grid columns="4fr max-content" gap="xl">
      <SummaryCardGroup
        title={t('Coverage On Selected Commit')}
        isLoading={false}
        placeholderCount={5}
        trailingHeaderItems={
          <Text size="sm" variant="muted">
            {t('This commit %s compared to', headCommit.shortSha)}{' '}
            <Link to={`/prevent/coverage/commits/${baseCommit.sha}`}>
              {baseCommit.shortSha}
            </Link>
          </Text>
        }
      >
        <Fragment>
          <SummaryCard
            label={t('Repository coverage')}
            tooltip={t('Repository coverage tooltip')}
            value="98.98%"
            extra={
              <Text size="sm" variant="muted">
                {tct('Head: [commitLink]', {
                  commitLink: (
                    <Link to={`/prevent/coverage/commits/${headCommit.sha}`}>
                      {headCommit.shortSha}
                    </Link>
                  ),
                })}
              </Text>
            }
          />
          <SummaryCard
            label={t('Patch coverage')}
            tooltip={t('Patch coverage tooltip')}
            value="100%"
          />
          <SummaryCard
            label={t('Uncovered lines')}
            tooltip={t('Uncovered lines tooltip')}
            value={5}
            filterBy="uncoveredLines"
          />
          <SummaryCard
            label={t('Files changed')}
            tooltip={t('Files changed tooltip')}
            value={4}
            filterBy="filesChanged"
          />
          <SummaryCard
            label={t('Indirect changes')}
            tooltip={t('Indirect changes tooltip')}
            value={1}
            filterBy="indirectChanges"
          />
        </Fragment>
      </SummaryCardGroup>
      <SummaryCardGroup
        title={t('Coverage Uploads - %s', headCommit.shortSha)}
        isLoading={false}
        placeholderCount={1}
      >
        <SummaryCard
          label={t('Uploads count')}
          tooltip={t('Uploads count tooltip')}
          value={65}
          filterBy="uploadsCount"
          extra={
            <Text size="sm" variant="muted">
              {t('(%s processed, %s pending)', 65, 15)}
            </Text>
          }
        />
      </SummaryCardGroup>
    </Grid>
  );
}
