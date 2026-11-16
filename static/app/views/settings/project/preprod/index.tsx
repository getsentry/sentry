import {Fragment} from 'react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Container, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {Feature} from 'sentry/components/acl/feature';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PreprodQuotaAlert} from 'sentry/views/preprod/components/preprodQuotaAlert';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {FeatureFilter} from './featureFilter';
import {PrCommentRules} from './prCommentRules';
import {PrCommentsToggle} from './prCommentsToggle';
import {StatusCheckRules} from './statusCheckRules';

const PREPROD_TABS = ['size', 'distribution'] as const;

type PreprodTab = (typeof PREPROD_TABS)[number];

const SIZE_ENABLED_READ_KEY = 'sentry:preprod_size_enabled_by_customer';
const SIZE_ENABLED_WRITE_KEY = 'preprodSizeEnabledByCustomer';
const SIZE_ENABLED_QUERY_READ_KEY = 'sentry:preprod_size_enabled_query';
const SIZE_ENABLED_QUERY_WRITE_KEY = 'preprodSizeEnabledQuery';

const DISTRIBUTION_ENABLED_READ_KEY = 'sentry:preprod_distribution_enabled_by_customer';
const DISTRIBUTION_ENABLED_WRITE_KEY = 'preprodDistributionEnabledByCustomer';
const DISTRIBUTION_ENABLED_QUERY_READ_KEY = 'sentry:preprod_distribution_enabled_query';
const DISTRIBUTION_ENABLED_QUERY_WRITE_KEY = 'preprodDistributionEnabledQuery';

export default function PreprodSettings() {
  const [tabParam, setTabParam] = useQueryState(
    'tab',
    parseAsStringLiteral(PREPROD_TABS)
  );
  const tab = tabParam ?? 'size';

  const handleTabChange = (newTab: PreprodTab) => {
    setTabParam(newTab, {history: 'push'});
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Mobile Builds')} />
      <SettingsPageHeader
        title={{
          type: 'page-title',
          label: t('Mobile Builds'),
          trailingActions: {type: 'badge', element: <FeatureBadge type="new" />},
        }}
        subtitle={t(
          'Configure status checks and thresholds for your mobile build size analysis.'
        )}
      />
      <Stack gap="lg">
        <PreprodQuotaAlert />
        <Container borderBottom="primary">
          <Tabs value={tab} onChange={handleTabChange}>
            <TabList>
              <TabList.Item key="size">{t('Size Analysis')}</TabList.Item>
              <TabList.Item key="distribution">{t('Build Distribution')}</TabList.Item>
            </TabList>
          </Tabs>
        </Container>
        {tab === 'size' && (
          <Fragment>
            <FeatureFilter
              enabledReadKey={SIZE_ENABLED_READ_KEY}
              enabledWriteKey={SIZE_ENABLED_WRITE_KEY}
              queryReadKey={SIZE_ENABLED_QUERY_READ_KEY}
              queryWriteKey={SIZE_ENABLED_QUERY_WRITE_KEY}
              title={t('Size Analysis')}
              successMessage={t('Size analysis settings updated')}
              docsUrl="https://docs.sentry.io/product/size-analysis/#configuring-size-analysis-uploads"
            />
            <StatusCheckRules />
            <Feature features="organizations:preprod-size-analysis-pr-comments">
              <PrCommentRules />
            </Feature>
          </Fragment>
        )}
        {tab === 'distribution' && (
          <Fragment>
            <FeatureFilter
              enabledReadKey={DISTRIBUTION_ENABLED_READ_KEY}
              enabledWriteKey={DISTRIBUTION_ENABLED_WRITE_KEY}
              queryReadKey={DISTRIBUTION_ENABLED_QUERY_READ_KEY}
              queryWriteKey={DISTRIBUTION_ENABLED_QUERY_WRITE_KEY}
              title={t('Build Distribution')}
              successMessage={t('Build distribution settings updated')}
              docsUrl="https://docs.sentry.io/product/build-distribution/"
              display={PreprodBuildsDisplay.DISTRIBUTION}
            />
            <PrCommentsToggle />
          </Fragment>
        )}
      </Stack>
    </Fragment>
  );
}
