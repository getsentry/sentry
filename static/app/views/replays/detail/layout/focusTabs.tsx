import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs({
  isVideoReplay,
}: {
  isVideoReplay: boolean;
}): Record<TabKey, ReactNode> {
  // For video replays, we hide the a11y and memory tabs (not applicable for mobile)
  return {
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.NETWORK]: t('Network'),
    [TabKey.ERRORS]: t('Errors'),
    [TabKey.TRACE]: t('Trace'),
    [TabKey.A11Y]: isVideoReplay ? null : (
      <Fragment>
        <Tooltip
          isHoverable
          title={
            <ExternalLink
              href="https://developer.mozilla.org/en-US/docs/Learn/Accessibility/What_is_accessibility"
              onClick={e => {
                e.stopPropagation();
              }}
            >
              {t('What is accessibility?')}
            </ExternalLink>
          }
        >
          {t('Accessibility')}
        </Tooltip>
        <FlexFeatureBadge
          type="alpha"
          title={t('This feature is available for early adopters and may change')}
        />
      </Fragment>
    ),
    [TabKey.MEMORY]: isVideoReplay ? null : t('Memory'),
    [TabKey.TAGS]: t('Tags'),
  };
}

type Props = {
  isVideoReplay: boolean;
  className?: string;
};

function FocusTabs({className, isVideoReplay}: Props) {
  const organization = useOrganization();
  const {pathname, query} = useLocation();
  const {getActiveTab, setActiveTab} = useActiveReplayTab({isVideoReplay});
  const activeTab = getActiveTab();

  return (
    <ScrollableTabs className={className} underlined>
      {Object.entries(getReplayTabs({isVideoReplay})).map(([tab, label]) =>
        label ? (
          <ListLink
            data-test-id={`replay-details-${tab}-btn`}
            key={tab}
            isActive={() => tab === activeTab}
            to={{pathname, query: {...query, t_main: tab}}}
            onClick={e => {
              e.preventDefault();
              setActiveTab(tab);

              trackAnalytics('replay.details-tab-changed', {
                tab,
                organization,
                mobile: isVideoReplay,
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

const FlexFeatureBadge = styled(FeatureBadge)`
  & > span {
    display: flex;
  }
`;

export default FocusTabs;
