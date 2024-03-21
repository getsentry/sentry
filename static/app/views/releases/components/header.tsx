import {useState} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {TabList, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type Props = {
  organization: Organization;
  router: InjectedRouter;
  hasV2ReleaseUIEnabled?: boolean;
};

const enum ReleaseTab {
  RELEASES = 'releases',
  RELEASE_THRESHOLDS = 'release-thresholds',
}

function Header({router, hasV2ReleaseUIEnabled = false, organization}: Props) {
  const [selected, setSelected] = useState<ReleaseTab>(
    router.location.pathname.includes('release-thresholds')
      ? ReleaseTab.RELEASE_THRESHOLDS
      : ReleaseTab.RELEASES
  );

  const location = router.location;
  const {
    cursor: _cursor,
    page: _page,
    view: _view,
    ...queryParams
  } = location?.query ?? {};

  const tabs = hasV2ReleaseUIEnabled
    ? [
        {
          key: ReleaseTab.RELEASES,
          label: t('Monitor'),
          description: '',
          to: normalizeUrl(
            `/organizations/${organization.slug}/releases/?${qs.stringify(queryParams)}`
          ),
        },
        {
          key: ReleaseTab.RELEASE_THRESHOLDS,
          label: t('Thresholds'),
          description:
            'thresholds represent action alerts that will trigger once a threshold has been breached',
          to: normalizeUrl(
            `/organizations/${organization.slug}/release-thresholds/?${qs.stringify(queryParams)}`
          ),
          badge: <FeatureBadge type="alpha" />,
        },
      ]
    : [];

  const onTabSelect = (key: ReleaseTab) => {
    setSelected(key);
  };

  return (
    <Layout.Header noActionWrap>
      <Layout.HeaderContent>
        <Layout.Title>
          {t('Releases')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/releases/"
            title={t(
              'A visualization of your release adoption from the past 24 hours, providing a high-level view of the adoption stage, percentage of crash-free users and sessions, and more.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      {hasV2ReleaseUIEnabled && (
        <StyledTabs value={selected} onChange={onTabSelect}>
          <TabList hideBorder>
            {tabs.map(({label, description, key, to, badge}) => {
              return (
                <TabList.Item key={key} to={to} textValue={label}>
                  <Tooltip
                    title={description}
                    position="bottom"
                    isHoverable
                    delay={SLOW_TOOLTIP_DELAY}
                  >
                    {label}
                    {badge}
                  </Tooltip>
                </TabList.Item>
              );
            })}
          </TabList>
        </StyledTabs>
      )}
    </Layout.Header>
  );
}

export default Header;

const StyledTabs = styled(Tabs<ReleaseTab>)`
  grid-column: 1/-1;
`;
