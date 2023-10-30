import {useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {TabList, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {MONITOR_PATH, THRESHOLDS_PATH} from '../utils/constants';

type Props = {
  router: InjectedRouter;
  hasV2ReleaseUIEnabled?: boolean;
  newThresholdAction?: () => void;
  newThresholdDisabled?: boolean;
};

function Header({
  router,
  hasV2ReleaseUIEnabled = false,
  newThresholdAction = () => {},
  newThresholdDisabled = true,
}: Props) {
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
          key: MONITOR_PATH,
          label: t('Monitor'),
          description: '',
          path: MONITOR_PATH,
        },
        {
          key: THRESHOLDS_PATH,
          label: t('Thresholds'),
          description:
            'thresholds represent action alerts that will trigger once a threshold has been breached',
          path: THRESHOLDS_PATH,
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
      {hasV2ReleaseUIEnabled && selected === THRESHOLDS_PATH && (
        <Layout.HeaderActions>
          <Tooltip
            title="Select a single project from the project filters to create a threshold for"
            position="bottom"
            isHoverable
            delay={SLOW_TOOLTIP_DELAY}
          >
            <Button
              size="sm"
              priority="primary"
              onClick={newThresholdAction}
              disabled={newThresholdDisabled}
            >
              <IconAdd isCircled /> &nbsp; {t('New Threshold')}
            </Button>
          </Tooltip>
        </Layout.HeaderActions>
      )}
      <StyledTabs value={selected} onChange={onTabSelect}>
        <TabList hideBorder>
          {tabs.map(({key, label, description, path}) => {
            const to_url = normalizeUrl({
              query: {
                ...queryParams,
              },
              pathname: path,
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
