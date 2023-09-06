import {useRef} from 'react';
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

import {THRESHOLDS_VIEW} from '../utils/constants';

type Props = {
  hasV2ReleaseUIEnabled: boolean;
  organization: Organization;
  router: InjectedRouter;
};

function Header({router, hasV2ReleaseUIEnabled}: Props) {
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
          name: t('Foobar'),
          description: '',
          view: 'release_list',
        },
        {
          name: t('Thresholds'),
          description:
            'thresholds represent action alerts that will trigger once a threshold has been breached',
          view: 'thresholds',
        },
      ]
    : [];

  useRef(() => {
    if (queryParams.view === THRESHOLDS_VIEW && !hasV2ReleaseUIEnabled) {
      // TODO:
      // If flag not set - remove the view param?
      // OR - just don't render the thresholds content :shrug:
      // Opt for the simplest solution
    }
  });

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
      <StyledTabs>
        <TabList hideBorder>
          {tabs.map(({name: queryName, description, view}) => {
            const to_url = normalizeUrl({
              query: {
                view,
                ...queryParams,
              },
              pathname: location.pathname,
            });

            return (
              <TabList.Item key={queryName} to={to_url} textValue={queryName}>
                <Tooltip
                  title={description}
                  position="bottom"
                  isHoverable
                  delay={SLOW_TOOLTIP_DELAY}
                >
                  {queryName}
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
