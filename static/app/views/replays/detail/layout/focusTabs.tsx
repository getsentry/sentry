import {Fragment, ReactNode} from 'react';
import queryString from 'query-string';

import FeatureBadge from 'sentry/components/featureBadge';
import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs(organization: Organization): Record<TabKey, ReactNode> {
  const hasReplayNetworkDetails = organization.features.includes(
    'session-replay-network-details'
  );

  const networkLabel = hasReplayNetworkDetails ? (
    <Fragment>
      {t('Network')} <FeatureBadge type="new" />
    </Fragment>
  ) : (
    t('Network')
  );

  return {
    [TabKey.console]: t('Console'),
    [TabKey.network]: networkLabel,
    [TabKey.dom]: t('DOM Events'),
    [TabKey.issues]: t('Issues'),
    [TabKey.memory]: t('Memory'),
    [TabKey.trace]: t('Trace'),
  };
}

type Props = {
  className?: string;
};

function FocusTabs({className}: Props) {
  const organization = useOrganization();
  const {pathname, query} = useLocation();
  const {getActiveTab, setActiveTab} = useActiveReplayTab();
  const activeTab = getActiveTab();

  return (
    <ScrollableTabs className={className} underlined>
      {Object.entries(getReplayTabs(organization)).map(([tab, label]) => (
        <ListLink
          key={tab}
          isActive={() => tab === activeTab}
          to={`${pathname}?${queryString.stringify({...query, t_main: tab})}`}
          onClick={e => {
            e.preventDefault();
            setActiveTab(tab);

            trackAnalytics('replay.details-tab-changed', {
              tab,
              organization,
            });
          }}
        >
          {label}
        </ListLink>
      ))}
    </ScrollableTabs>
  );
}

export default FocusTabs;
