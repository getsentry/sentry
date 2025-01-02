import {Fragment} from 'react';

import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import ReleaseIsssues from 'sentry/components/devtoolbar/components/releases/releaseIssues';
import useReleaseSessions from 'sentry/components/devtoolbar/components/releases/useReleaseSessions';
import useToolbarRelease from 'sentry/components/devtoolbar/components/releases/useToolbarRelease';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  infoHeaderCss,
  releaseBoxCss,
  releaseNumbersCss,
  subtextCss,
} from 'sentry/components/devtoolbar/styles/releasesPanel';
import {
  resetFlexColumnCss,
  resetFlexRowCss,
} from 'sentry/components/devtoolbar/styles/reset';
import type {ApiResult} from 'sentry/components/devtoolbar/types';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons/iconArrow';
import type {SessionApiResponse} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  ReleaseInfoHeader,
  ReleaseInfoSubheader,
  VersionWrapper,
} from 'sentry/views/releases/list/releaseCard';
import ReleaseCardCommits from 'sentry/views/releases/list/releaseCard/releaseCardCommits';

import useConfiguration from '../../hooks/useConfiguration';
import {
  panelDescCss,
  panelInsetContentCss,
  panelSectionCss,
  panelSectionCssNoBorder,
} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

const summaryPlaceholderHeight = '65px';
const crashComparisonPlaceholderHeight = '61px';
const issueListPlaceholderHeight = '320px';

function getCrashFreeRate(data: ApiResult<SessionApiResponse>): number {
  // if `crash_free_rate(session)` is undefined
  // (sometimes the case for brand new releases),
  // assume it is 100%.
  // round to 2 decimal points
  return parseFloat(
    ((data?.json.groups[0]!.totals['crash_free_rate(session)'] ?? 1) * 100).toFixed(2)
  );
}

function getDiff(
  diff: string,
  diffColor: string[],
  diffDirection: 'up' | 'down' | undefined
) {
  return (
    <div
      css={[
        releaseBoxCss,
        releaseNumbersCss,
        {
          backgroundColor: diffColor[1],
          borderColor: diffColor[0],
        },
      ]}
    >
      <span css={[smallCss, {color: diffColor[0], fontWeight: 'bold'}]}>Change</span>
      <span
        css={[
          resetFlexRowCss,
          {
            alignItems: 'center',
            gap: 'var(--space25)',
            color: diffColor[0],
          },
        ]}
      >
        {diff}
        {defined(diffDirection) ? (
          <IconArrow direction={diffDirection} size="sm" />
        ) : null}
      </span>
    </div>
  );
}

function ReleaseSummary({orgSlug, release}: {orgSlug: string; release: Release}) {
  return (
    <PanelItem css={[releaseBoxCss, {width: '92%', alignItems: 'flex-start'}]}>
      <ReleaseInfoHeader css={infoHeaderCss}>
        <AnalyticsProvider nameVal="latest release" keyVal="latest-release">
          <SentryAppLink
            to={{
              url: `/organizations/${orgSlug}/releases/${encodeURIComponent(release.version)}/`,
              query: {project: release.projects[0]!.id},
            }}
          >
            <VersionWrapper>{formatVersion(release.version)}</VersionWrapper>
          </SentryAppLink>
          {release.commitCount > 0 && (
            <ReleaseCardCommits release={release} withHeading={false} />
          )}
        </AnalyticsProvider>
      </ReleaseInfoHeader>
      <ReleaseInfoSubheader
        css={[resetFlexColumnCss, subtextCss, {alignItems: 'flex-start'}]}
      >
        <span css={[resetFlexRowCss, {gap: 'var(--space25)'}]}>
          <TimeSince date={release.lastDeploy?.dateFinished || release.dateCreated} />
          {release.lastDeploy?.dateFinished &&
            ` \u2022 ${release.lastDeploy.environment}`}
        </span>
      </ReleaseInfoSubheader>
    </PanelItem>
  );
}

function CrashFreeRate({
  prevReleaseVersion,
  currReleaseVersion,
}: {
  currReleaseVersion: string;
  prevReleaseVersion: string | undefined;
}) {
  const {
    data: currSessionData,
    isPending: isCurrLoading,
    isError: isCurrError,
  } = useReleaseSessions({
    releaseVersion: currReleaseVersion,
  });
  const {
    data: prevSessionData,
    isPending: isPrevLoading,
    isError: isPrevError,
  } = useReleaseSessions({
    releaseVersion: prevReleaseVersion,
  });

  if (isCurrError || isPrevError) {
    return null;
  }

  if (isCurrLoading || isPrevLoading) {
    return (
      <PanelItem css={{width: '100%', padding: 'var(--space150)'}}>
        <Placeholder
          height={crashComparisonPlaceholderHeight}
          css={[
            resetFlexColumnCss,
            panelSectionCss,
            panelInsetContentCss,
            listItemPlaceholderWrapperCss,
          ]}
        />
      </PanelItem>
    );
  }

  const currCrashFreeRate = getCrashFreeRate(currSessionData);
  const prevCrashFreeRate = getCrashFreeRate(prevSessionData);
  const diff = currCrashFreeRate - prevCrashFreeRate;
  const sign = Math.sign(diff);

  return (
    <div>
      <span css={[smallCss, panelDescCss, panelSectionCssNoBorder, {paddingBottom: 0}]}>
        Crash Free Session Rate
      </span>
      <div
        css={[
          {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 'var(--space100)',
            padding: 'var(--space75) var(--space150) var(--space150) var(--space150)',
          },
        ]}
      >
        <div css={[releaseBoxCss, releaseNumbersCss]}>
          <span css={[smallCss, {fontWeight: 'bold'}]}>Latest</span>
          {currCrashFreeRate}%
        </div>
        <div css={[releaseBoxCss, releaseNumbersCss]}>
          <span css={[smallCss, {fontWeight: 'bold'}]}>Previous</span>
          {prevCrashFreeRate}%
        </div>
        {getDiff(
          Math.abs(diff).toFixed(2) + '%',
          sign === 0
            ? ['black', 'white']
            : sign === 1
              ? ['var(--green400)', 'var(--green100)']
              : ['var(--red400)', 'var(--red100)'],
          sign === 0 ? undefined : sign === 1 ? 'up' : 'down'
        )}
      </div>
    </div>
  );
}

export default function ReleasesPanel() {
  const {
    data: releaseData,
    isPending: isReleaseDataLoading,
    isError: isReleaseDataError,
  } = useToolbarRelease();

  const {organizationSlug} = useConfiguration();

  if (isReleaseDataError) {
    return <EmptyStateWarning small>No data to show</EmptyStateWarning>;
  }

  return (
    <PanelLayout title="Latest Release" showProjectBadge link={{url: '/releases/'}}>
      <AnalyticsProvider nameVal="header" keyVal="header">
        <span css={[smallCss, panelDescCss, panelSectionCssNoBorder, {paddingBottom: 0}]}>
          Latest Release
        </span>
      </AnalyticsProvider>
      {isReleaseDataLoading ? (
        <div
          css={[
            resetFlexColumnCss,
            panelSectionCss,
            panelInsetContentCss,
            listItemPlaceholderWrapperCss,
          ]}
        >
          <Placeholder height={summaryPlaceholderHeight} />
          <Placeholder height={crashComparisonPlaceholderHeight} />
          <Placeholder height={issueListPlaceholderHeight} />
        </div>
      ) : (
        <Fragment>
          <div style={{alignItems: 'start'}}>
            <ReleaseSummary release={releaseData.json[0]!} orgSlug={organizationSlug} />
            <CrashFreeRate
              currReleaseVersion={releaseData.json[0]!.version}
              prevReleaseVersion={
                releaseData.json.length > 1 ? releaseData.json[1]!.version : undefined
              }
            />
            <ReleaseIsssues releaseVersion={releaseData.json[0]!.version} />
          </div>
        </Fragment>
      )}
    </PanelLayout>
  );
}
