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
  const hasErrorTab = organization.features.includes('session-replay-errors-tab');

  const networkLabel = !hasErrorTab ? (
    <Fragment>
      {t('Network')} <FeatureBadge type="new" />
    </Fragment>
  ) : (
    t('Network')
  );

  const errorLabel = hasErrorTab ? (
    <Fragment>
      {t('Errors')} <FeatureBadge type="new" />
    </Fragment>
  ) : (
    t('Errors')
  );

  return {
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.NETWORK]: networkLabel,
    [TabKey.DOM]: t('DOM Events'),
    [TabKey.ERRORS]: hasErrorTab ? errorLabel : null,
    [TabKey.ISSUES]: hasErrorTab ? null : t('Issues'),
    [TabKey.MEMORY]: t('Memory'),
    [TabKey.TRACE]: t('Trace'),
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
      {Object.entries(getReplayTabs(organization)).map(([tab, label]) =>
        label ? (
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
        ) : null
      )}
    </ScrollableTabs>
  );
}

export default FocusTabs;
