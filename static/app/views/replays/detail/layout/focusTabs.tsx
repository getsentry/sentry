import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs({
  isVideoReplay,
  organization,
}: {
  isVideoReplay: boolean;
  organization: Organization;
}): Record<TabKey, ReactNode> {
  // For video replays, we hide the console, a11y, trace, and memory tabs
  // The console tab isn't useful for video replays (for now); most of the
  // useful logging context will come from breadcrumbs
  // A11y, trace, and memory aren't applicable for mobile

  // Show the console tab if 1) it's a video replay and we have the FF enabled
  // or 2) it's not a video replay
  const showConsoleTab = isVideoReplay
    ? organization.features.includes('session-replay-mobile-network-tab')
    : true;

  return {
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: showConsoleTab ? t('Console') : null,
    [TabKey.NETWORK]: t('Network'),
    [TabKey.ERRORS]: t('Errors'),
    [TabKey.TRACE]: isVideoReplay ? null : t('Trace'),
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

  const isTabDisabled = (tab: string) => {
    return (
      tab === TabKey.NETWORK &&
      isVideoReplay &&
      !organization.features.includes('session-replay-mobile-network-tab')
    );
  };

  return (
    <ScrollableTabs className={className} underlined>
      {Object.entries(getReplayTabs({organization, isVideoReplay})).map(([tab, label]) =>
        label ? (
          <ListLink
            disabled={isTabDisabled(tab)}
            data-test-id={`replay-details-${tab}-btn`}
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
            <Tooltip title={isTabDisabled(tab) ? t('This feature is coming soon') : null}>
              {label}
            </Tooltip>
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
