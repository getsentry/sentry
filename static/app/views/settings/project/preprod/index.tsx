import {Fragment} from 'react';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import Feature from 'sentry/components/acl/feature';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {PreprodQuotaAlert} from 'sentry/views/preprod/components/preprodQuotaAlert';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {FeatureFilter} from './featureFilter';
import {PrCommentsToggle} from './prCommentsToggle';
import {SnapshotPrCommentsToggle} from './snapshotPrCommentsToggle';
import {SnapshotStatusChecks} from './snapshotStatusChecks';
import {StatusCheckRules} from './statusCheckRules';

type PreprodTab = 'size' | 'distribution' | 'snapshots';

const SIZE_ENABLED_READ_KEY = 'sentry:preprod_size_enabled_by_customer';
const SIZE_ENABLED_WRITE_KEY = 'preprodSizeEnabledByCustomer';
const SIZE_ENABLED_QUERY_READ_KEY = 'sentry:preprod_size_enabled_query';
const SIZE_ENABLED_QUERY_WRITE_KEY = 'preprodSizeEnabledQuery';

const DISTRIBUTION_ENABLED_READ_KEY = 'sentry:preprod_distribution_enabled_by_customer';
const DISTRIBUTION_ENABLED_WRITE_KEY = 'preprodDistributionEnabledByCustomer';
const DISTRIBUTION_ENABLED_QUERY_READ_KEY = 'sentry:preprod_distribution_enabled_query';
const DISTRIBUTION_ENABLED_QUERY_WRITE_KEY = 'preprodDistributionEnabledQuery';

const VALID_TABS: PreprodTab[] = ['size', 'distribution', 'snapshots'];

export default function PreprodSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();

  const hasSnapshots = organization.features.includes('preprod-snapshots');

  const availableTabs = hasSnapshots
    ? VALID_TABS
    : VALID_TABS.filter(tab => tab !== 'snapshots');
  const queryTab = decodeScalar(location?.query?.tab);
  const tab = availableTabs.includes(queryTab as PreprodTab)
    ? (queryTab as PreprodTab)
    : 'size';

  const handleTabChange = (newTab: PreprodTab) => {
    navigate({query: {...location.query, tab: newTab}});
  };

  return (
    <Feature features="organizations:preprod-frontend-routes" renderDisabled>
      <SentryDocumentTitle title={t('Mobile Builds')} />
      <SettingsPageHeader
        title={t('Mobile Builds')}
        subtitle={t(
          'Configure status checks and thresholds for your mobile build size analysis.'
        )}
        action={
          <Grid flow="column" align="center" gap="lg">
            {hasPageFrameFeature ? (
              <TopBar.Slot name="feedback">
                <FeedbackButton>{null}</FeedbackButton>
              </TopBar.Slot>
            ) : (
              <FeedbackButton />
            )}
          </Grid>
        }
      />
      <Stack gap="lg">
        <PreprodQuotaAlert />
        <Container borderBottom="primary">
          <Tabs value={tab} onChange={handleTabChange}>
            <TabList>
              <TabList.Item key="size">{t('Size Analysis')}</TabList.Item>
              <TabList.Item key="distribution">{t('Build Distribution')}</TabList.Item>
              <TabList.Item key="snapshots" hidden={!hasSnapshots}>
                {t('Snapshots')}
              </TabList.Item>
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
            <Feature features="organizations:preprod-build-distribution-pr-comments">
              <PrCommentsToggle />
            </Feature>
          </Fragment>
        )}
        {tab === 'snapshots' && (
          <Fragment>
            <SnapshotStatusChecks />
            <Feature features="organizations:preprod-snapshot-pr-comments">
              <SnapshotPrCommentsToggle />
            </Feature>
          </Fragment>
        )}
      </Stack>
    </Feature>
  );
}
