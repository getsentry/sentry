import {Fragment} from 'react';
import {css} from '@emotion/react';

import useReleaseSessions from 'sentry/components/devtoolbar/components/releases/useReleaseSessions';
import useToolbarRelease from 'sentry/components/devtoolbar/components/releases/useToolbarRelease';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {infoHeaderCss} from 'sentry/components/devtoolbar/styles/releasesPanel';
import {
  resetFlexColumnCss,
  resetFlexRowCss,
} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons/iconArrow';
import type {PlatformKey} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  Change,
  type ReleaseComparisonRow,
} from 'sentry/views/releases/detail/overview/releaseComparisonChart';
import {
  PackageName,
  ReleaseInfoHeader,
  ReleaseInfoSubheader,
  VersionWrapper,
} from 'sentry/views/releases/list/releaseCard';
import ReleaseCardCommits from 'sentry/views/releases/list/releaseCard/releaseCardCommits';

import useConfiguration from '../../hooks/useConfiguration';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

function getCrashFreeRate(data) {
  return ((data?.json.groups[0].totals['crash_free_rate(session)'] ?? 1) * 100).toFixed(
    2
  );
}

function getChartDiff(
  diff: string,
  diffColor: ReleaseComparisonRow['diffColor'],
  diffDirection: 'up' | 'down' | undefined
) {
  return diff ? (
    <Change
      color={defined(diffColor) ? diffColor : 'black'}
      css={[resetFlexRowCss, `align-items: center; gap: 3px`]}
    >
      {diff}
      {defined(diffDirection) ? <IconArrow direction={diffDirection} size="xs" /> : null}
    </Change>
  ) : null;
}

function ReleaseHeader({release, orgSlug}: {orgSlug: string; release: Release}) {
  return (
    <PanelItem style={{width: '100%', alignItems: 'flex-start'}}>
      <ReleaseInfoHeader css={[infoHeaderCss]}>
        <SentryAppLink
          to={{
            url: `/organizations/${orgSlug}/releases/${encodeURIComponent(release.version)}/`,
            query: {project: release.projects[0].id},
          }}
        >
          <VersionWrapper>{formatVersion(release.version)}</VersionWrapper>
        </SentryAppLink>
        {release.commitCount > 0 && (
          <ReleaseCardCommits release={release} withHeading={false} />
        )}
      </ReleaseInfoHeader>
      <ReleaseInfoSubheader
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          fontSize: '14px',
        }}
      >
        {release.versionInfo?.package && (
          <PackageName>
            <TextOverflow ellipsisDirection="left">
              {release.versionInfo.package}
            </TextOverflow>
          </PackageName>
        )}
        <span style={{display: 'flex', flexDirection: 'row', gap: '3px'}}>
          <TimeSince date={release.lastDeploy?.dateFinished || release.dateCreated} />
          {release.lastDeploy?.dateFinished &&
            ` \u007C ${release.lastDeploy.environment}`}
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
  prevReleaseVersion: string;
}) {
  const {data: currSessionData, isLoading: isCurrLoading} = useReleaseSessions({
    releaseVersion: currReleaseVersion,
  });
  const {data: prevSessionData, isLoading: isPrevLoading} = useReleaseSessions({
    releaseVersion: prevReleaseVersion,
  });

  const currCrashFreeRate = getCrashFreeRate(currSessionData);
  const prevCrashFreeRate = getCrashFreeRate(prevSessionData);
  const diff = (parseFloat(currCrashFreeRate) - parseFloat(prevCrashFreeRate)).toFixed(2);
  const diffIsZero = parseFloat(diff) === 0;
  const posDiff = parseFloat(diff) > 0;

  return (
    <PanelItem>
      <div css={[infoHeaderCss]}>Crash Free Session Rate</div>
      <ReleaseInfoSubheader style={{fontSize: '14px'}}>
        {isPrevLoading || isCurrLoading ? (
          <Placeholder width="252px" height="40px" />
        ) : (
          <span style={{display: 'flex', gap: '16px', flexDirection: 'row'}}>
            <span css={[resetFlexColumnCss]}>
              <span>This release</span> {currCrashFreeRate}%
            </span>
            <span css={[resetFlexColumnCss]}>
              <span>Prev release</span> {prevCrashFreeRate}%
            </span>
            <span css={[resetFlexColumnCss]}>
              <span>Change</span>
              {getChartDiff(
                Math.abs(parseFloat(diff)) + '%',
                diffIsZero ? 'black' : posDiff ? 'green400' : 'red400',
                diffIsZero ? undefined : posDiff ? 'up' : 'down'
              )}
            </span>
          </span>
        )}
      </ReleaseInfoSubheader>
    </PanelItem>
  );
}

export default function ReleasesPanel() {
  const {
    data: releaseData,
    isLoading: isReleaseDataLoading,
    isError: isReleaseDataError,
  } = useToolbarRelease();

  const {organizationSlug, projectSlug, projectId, projectPlatform, trackAnalytics} =
    useConfiguration();

  const estimateSize = 100;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Latest Release">
      <span
        css={[
          smallCss,
          panelSectionCss,
          panelInsetContentCss,
          resetFlexRowCss,
          {gap: 'var(--space50)', flexGrow: 0},
        ]}
      >
        Latest release for{' '}
        <SentryAppLink
          to={{
            url: `/releases/`,
            query: {project: projectId},
          }}
          onClick={() => {
            trackAnalytics?.({
              eventKey: `devtoolbar.releases-list.header.click`,
              eventName: `devtoolbar: Click releases-list header`,
            });
          }}
        >
          <div
            css={[
              resetFlexRowCss,
              {display: 'inline-flex', gap: 'var(--space50)', alignItems: 'center'},
            ]}
          >
            <ProjectBadge
              css={css({'&& img': {boxShadow: 'none'}})}
              project={{
                slug: projectSlug,
                id: projectId,
                platform: projectPlatform as PlatformKey,
              }}
              avatarSize={16}
              hideName
              avatarProps={{hasTooltip: false}}
            />
            {projectSlug}
          </div>
        </SentryAppLink>
      </span>
      {isReleaseDataLoading || isReleaseDataError ? (
        <div
          css={[
            resetFlexColumnCss,
            panelSectionCss,
            panelInsetContentCss,
            listItemPlaceholderWrapperCss,
          ]}
        >
          <Placeholder height={placeholderHeight} />
          <Placeholder height={placeholderHeight} />
        </div>
      ) : (
        <Fragment>
          <div style={{alignItems: 'start'}}>
            <ReleaseHeader release={releaseData.json[0]} orgSlug={organizationSlug} />
            <CrashFreeRate
              currReleaseVersion={releaseData.json[0].version}
              prevReleaseVersion={releaseData.json[1].version}
            />
          </div>
        </Fragment>
      )}
    </PanelLayout>
  );
}
