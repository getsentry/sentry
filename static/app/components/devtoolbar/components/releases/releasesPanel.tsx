import {Fragment} from 'react';
import {css} from '@emotion/react';

import useToolbarRelease from 'sentry/components/devtoolbar/components/releases/useToolbarRelease';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  resetFlexColumnCss,
  resetFlexRowCss,
} from 'sentry/components/devtoolbar/styles/reset';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import type {PlatformKey} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
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

function ReleaseHeader({release, orgSlug}: {orgSlug: string; release: Release}) {
  return (
    <div style={{padding: '12px'}}>
      <ReleaseInfoHeader>
        <SentryAppLink
          to={{
            url: `/organizations/${orgSlug}/releases/${encodeURIComponent(release.version)}/`,
            query: {project: release.projects[0].id},
          }}
        >
          <VersionWrapper>
            <TextOverflow>{formatVersion(release.version)}</TextOverflow>
          </VersionWrapper>
        </SentryAppLink>
        {release.commitCount > 0 && (
          <ReleaseCardCommits release={release} withHeading={false} />
        )}
      </ReleaseInfoHeader>
      <ReleaseInfoSubheader
        style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}
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
    </div>
  );
}

export default function ReleasesPanel() {
  const {data, isLoading, isError} = useToolbarRelease();
  const {organizationSlug, projectSlug, projectId, projectPlatform, trackAnalytics} =
    useConfiguration();

  const estimateSize = 515;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Latest Release">
      {isLoading || isError ? (
        <div
          css={[
            resetFlexColumnCss,
            panelSectionCss,
            panelInsetContentCss,
            listItemPlaceholderWrapperCss,
          ]}
        >
          <Placeholder height={placeholderHeight} />
        </div>
      ) : (
        <Fragment>
          <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
            <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
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
          </div>
          <div style={{alignItems: 'start'}}>
            <ReleaseHeader release={data[0]} orgSlug={organizationSlug} />
          </div>
        </Fragment>
      )}
    </PanelLayout>
  );
}
