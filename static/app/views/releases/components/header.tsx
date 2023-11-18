import {useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {TabList, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type Props = {
  organization: Organization;
  router: InjectedRouter;
  hasV2ReleaseUIEnabled?: boolean;
};

function Header({router, hasV2ReleaseUIEnabled = false, organization}: Props) {
  const [selected, setSelected] = useState(router.location.pathname);

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
          label: t('Monitor'),
          description: '',
          path: normalizeUrl(`/organizations/${organization.slug}/releases/`),
          to: normalizeUrl({
            query: {
              ...queryParams,
            },
            pathname: `/organizations/${organization.slug}/releases/`,
          }),
        },
        {
          label: t('Thresholds'),
          description:
            'thresholds represent action alerts that will trigger once a threshold has been breached',
          path: normalizeUrl(`/organizations/${organization.slug}/release-thresholds/`),
          to: normalizeUrl({
            query: {
              ...queryParams,
            },
            pathname: `/organizations/${organization.slug}/release-thresholds/`,
          }),
        },
      ]
    : [];

  const onTabSelect = key => {
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
            {tabs.map(({label, description, path, to}) => {
              return (
                <TabList.Item key={path} to={to} textValue={label}>
                  <Tooltip
                    title={description}
                    position="bottom"
                    isHoverable
                    delay={SLOW_TOOLTIP_DELAY}
                  >
                    {label}
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

const StyledTabs = styled(Tabs)`
  grid-column: 1/-1;
`;
