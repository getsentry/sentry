import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {useMetricDetectorLimit} from 'getsentry/hooks/useMetricDetectorLimit';

function UpgradeLink({children}: {children?: React.ReactNode}) {
  const organization = useOrganization();

  return (
    <Button
      priority="link"
      onClick={() => {
        openUpsellModal({
          organization,
          source: 'metric-alert-quota',
        });
      }}
    >
      {children}
    </Button>
  );
}

export function MetricAlertQuotaIcon() {
  const metricAlertQuota = useMetricDetectorLimit();
  const organization = useOrganization();

  if (metricAlertQuota?.hasReachedLimit) {
    return (
      <Tooltip
        isHoverable
        title={tct(
          "You have reached your plan's limit on metric monitors. [removeLink:Remove existing monitors] or [upgradeLink:upgrade your plan].",
          {
            removeLink: <Link to={makeAlertsPathname({organization, path: '/rules/'})} />,
            upgradeLink: <UpgradeLink />,
          }
        )}
      >
        <IconWarning variant="muted" size="sm" />
      </Tooltip>
    );
  }

  return null;
}

export function MetricAlertQuotaMessage() {
  const organization = useOrganization();
  const metricAlertQuota = useMetricDetectorLimit();

  if (metricAlertQuota?.hasReachedLimit) {
    return tct(
      "You have reached your plan's limit on metric monitors ([limit]). [removeLink:Remove existing monitors] or [upgradeLink:upgrade your plan].",
      {
        limit: metricAlertQuota.detectorLimit.toLocaleString(),
        removeLink: <Link to={makeAlertsPathname({organization, path: '/rules/'})} />,
        upgradeLink: <UpgradeLink />,
      }
    );
  }

  if (
    metricAlertQuota &&
    metricAlertQuota.detectorLimit === metricAlertQuota.detectorCount + 1
  ) {
    return tct(
      'You have used [count] of [limit] metric monitors for your plan. To increase the limit, [upgradeLink:upgrade your plan].',
      {
        count: metricAlertQuota.detectorCount.toLocaleString(),
        limit: metricAlertQuota.detectorLimit.toLocaleString(),
        upgradeLink: <UpgradeLink />,
      }
    );
  }

  return null;
}
