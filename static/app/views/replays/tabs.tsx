import {Fragment, useMemo} from 'react';

import FeatureBadge from 'sentry/components/featureBadge';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  selected: 'replays' | 'selectors';
}

export default function ReplayTabs({selected}: Props) {
  const organization = useOrganization();
  const location = useLocation();

  const tabs = useMemo(
    () => [
      {
        key: 'replays',
        label: t('Replays'),
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
      },
      {
        key: 'selectors',
        label: (
          <Fragment>
            {t('Selectors')} <FeatureBadge type="new" />
          </Fragment>
        ),
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/selectors/`),
      },
    ],
    [organization.slug]
  );

  const hasDeadClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  return hasDeadClickFeature ? (
    <Tabs value={selected}>
      <TabList hideBorder>
        {tabs.map(tab => (
          <TabList.Item
            key={tab.key}
            to={{
              ...location,
              pathname: tab.pathname,
            }}
          >
            {tab.label}
          </TabList.Item>
        ))}
      </TabList>
    </Tabs>
  ) : null;
}
