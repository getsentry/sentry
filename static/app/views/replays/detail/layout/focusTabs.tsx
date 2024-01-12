import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import FeatureBadge from 'sentry/components/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs(organization: Organization): Record<TabKey, ReactNode> {
  // The new Accessibility tab:
  const hasA11yTab = organization.features.includes('session-replay-a11y-tab');

  // The new trace table inside Breadcrumb items:
  const hasTraceTable = organization.features.includes('session-replay-trace-table');

  return {
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.NETWORK]: t('Network'),
    [TabKey.ERRORS]: t('Errors'),
    [TabKey.TRACE]: hasTraceTable ? null : t('Trace'),
    [TabKey.PERF]: null,
    [TabKey.A11Y]: hasA11yTab ? (
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
    ) : null,
    [TabKey.MEMORY]: t('Memory'),
    [TabKey.TAGS]: t('Tags'),
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
