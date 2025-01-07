import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {t, tct} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetricDataSwitcherOutcome} from 'sentry/utils/performance/contexts/metricsCardinality';

import type {DiscoverQueryPageSource} from '../utils';
import {
  createUnnamedTransactionsDiscoverTarget,
  getIsMultiProject,
  getSelectedProjectPlatformsArray,
} from '../utils';

interface MetricEnhancedDataAlertProps extends MetricDataSwitcherOutcome {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  router: WithRouterProps['router'];
  source?: DiscoverQueryPageSource;
}

/**
 * From
 * https://github.com/getsentry/sentry-docs/blob/master/src/platforms/common/enriching-events/transaction-name.mdx
 */
const SUPPORTED_TRANSACTION_NAME_DOCS = [
  'javascript',
  'node',
  'python',
  'ruby',
  'native',
  'react-native',
  'dotnet',
  'unity',
  'flutter',
  'dart',
  'java',
  'android',
];
const UNSUPPORTED_TRANSACTION_NAME_DOCS = [
  'javascript.cordova',
  'javascript.nextjs',
  'native.minidumps',
];

export function MetricsDataSwitcherAlert(
  props: MetricEnhancedDataAlertProps
): React.ReactElement | null {
  const isOnFallbackThresolds = props.organization.features.includes(
    'performance-mep-bannerless-ui'
  );

  const handleReviewUpdatesClick = useCallback(() => {
    SidebarPanelStore.activatePanel(SidebarPanelKey.BROADCASTS);
  }, []);

  const docsLink = useMemo(() => {
    const platforms = getSelectedProjectPlatformsArray(props.location, props.projects);
    if (platforms.length < 1) {
      return null;
    }

    const platform = platforms[0]!;
    if (UNSUPPORTED_TRANSACTION_NAME_DOCS.includes(platform)) {
      return null;
    }

    const supportedPlatform = SUPPORTED_TRANSACTION_NAME_DOCS.find(platformBase =>
      platform.includes(platformBase)
    );

    if (!supportedPlatform) {
      return null;
    }

    return `https://docs.sentry.io/platforms/${supportedPlatform}/enriching-events/transaction-name/`;
  }, [props.location, props.projects]);

  const handleSwitchToCompatibleProjects = useCallback(() => {
    updateProjects(props.compatibleProjects || [], props.router);
  }, [props.compatibleProjects, props.router]);

  if (!props.shouldNotifyUnnamedTransactions && !props.shouldWarnIncompatibleSDK) {
    // Control showing generic sdk-alert here since stacking alerts is noisy.
    return null;
  }

  const discoverTarget = createUnnamedTransactionsDiscoverTarget(props);

  if (isOnFallbackThresolds) {
    return null;
  }

  if (props.shouldWarnIncompatibleSDK) {
    const updateSDK = (
      <Link to="" onClick={handleReviewUpdatesClick}>
        {t('update your SDK version')}
      </Link>
    );
    if (getIsMultiProject(props.eventView.project)) {
      if ((props.compatibleProjects ?? []).length === 0) {
        return (
          <Alert
            type="warning"
            showIcon
            data-test-id="landing-mep-alert-multi-project-all-incompatible"
          >
            {tct(
              `A few projects are incompatible with dynamic sampling. To enable this feature [updateSDK].`,
              {
                updateSDK,
              }
            )}
          </Alert>
        );
      }
      return (
        <Alert
          type="warning"
          showIcon
          data-test-id="landing-mep-alert-multi-project-incompatible"
        >
          {tct(
            `A few projects are incompatible with dynamic sampling. You can either [updateSDK] or [onlyViewCompatible]`,
            {
              updateSDK,
              onlyViewCompatible: (
                <Link to="" onClick={handleSwitchToCompatibleProjects}>
                  {t('only view compatible projects.')}
                </Link>
              ),
            }
          )}
        </Alert>
      );
    }

    return (
      <Alert
        type="warning"
        showIcon
        data-test-id="landing-mep-alert-single-project-incompatible"
      >
        {tct(
          `Your project has an outdated SDK which is incompatible with dynamic sampling. To enable this feature [updateSDK].`,
          {
            updateSDK,
          }
        )}
      </Alert>
    );
  }

  if (props.shouldNotifyUnnamedTransactions) {
    const discover = <Link to={discoverTarget}>{t('open them in Discover.')}</Link>;
    if (!docsLink) {
      return (
        <Alert type="warning" showIcon data-test-id="landing-mep-alert-unnamed-discover">
          {tct(
            `You have some unparameterized transactions which are incompatible with dynamic sampling. You can [discover]`,
            {
              discover,
            }
          )}
        </Alert>
      );
    }

    return (
      <Alert
        type="warning"
        showIcon
        data-test-id="landing-mep-alert-unnamed-discover-or-set"
      >
        {tct(
          `You have some unparameterized transactions which are incompatible with dynamic sampling. You can either [setNames] or [discover]`,
          {
            setNames: (
              <ExternalLink href={docsLink}>{t('set names manually')}</ExternalLink>
            ),
            discover,
          }
        )}
      </Alert>
    );
  }

  return null;
}
