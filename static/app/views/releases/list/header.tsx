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

import {MONITOR_VIEW, THRESHOLDS_VIEW} from '../utils/constants';

type Props = {
  hasV2ReleaseUIEnabled: boolean;
  organization: Organization;
  router: InjectedRouter;
};

function Header({router, hasV2ReleaseUIEnabled}: Props) {
  const [selected, setSelected] = useState(router.location.query.view);

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
          key: MONITOR_VIEW,
          label: t('Monitor'),
          description: '',
          query: MONITOR_VIEW,
        },
        {
          key: THRESHOLDS_VIEW,
          label: t('Thresholds'),
          description:
            'thresholds represent action alerts that will trigger once a threshold has been breached',
          query: THRESHOLDS_VIEW,
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
      <StyledTabs value={selected} onChange={onTabSelect}>
        <TabList hideBorder>
          {tabs.map(({key, label, description, query}) => {
            const to_url = normalizeUrl({
              query: {
                view: query,
                ...queryParams,
              },
              pathname: location.pathname,
            });

            return (
              <TabList.Item key={key} to={to_url} textValue={label}>
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
    </Layout.Header>
  );
}

export default Header;

const StyledTabs = styled(Tabs)`
  grid-column: 1/-1;
`;
