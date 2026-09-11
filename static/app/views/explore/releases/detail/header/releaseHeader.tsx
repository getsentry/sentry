import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {Badge, FeatureBadge} from '@sentry/scraps/badge';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {LinkButton} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {TabList} from '@sentry/scraps/tabs';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IdBadge} from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {URL_PARAM} from 'sentry/components/pageFilters/constants';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {IconEllipsis, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Release, ReleaseMeta, ReleaseProject} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {isMobileRelease} from 'sentry/views/explore/releases/utils';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

import {useReleaseMenuItems} from './useReleaseMenuItems';

const releaseFeedbackOptions = {
  messagePlaceholder: t('How can we improve the Releases experience?'),
  tags: {
    'feedback.source': 'release-detail',
  },
};

type Props = {
  location: Location;
  organization: Organization;
  project: Required<ReleaseProject>;
  refetchData: () => void;
  release: Release;
  releaseMeta: ReleaseMeta;
};

export function ReleaseHeader({
  location,
  organization,
  release,
  project,
  releaseMeta,
  refetchData,
}: Props) {
  const {version, url} = release;
  const {commitCount, commitFilesChanged} = releaseMeta;
  const {prevReleaseVersion, nextReleaseVersion} = release.currentProjectMeta;

  const menuItems = useReleaseMenuItems({
    organization,
    projectSlug: project.slug,
    refetchData,
    release,
    releaseMeta,
  });

  /**
   * Swaps the current version out of the current path, so paginating from a
   * sub-page (e.g. Files Changed) lands on the same sub-page of the neighbour.
   */
  function makeSiblingReleaseTarget(toRelease: string | null) {
    return toRelease
      ? {
          pathname: location.pathname
            .replace(encodeURIComponent(version), encodeURIComponent(toRelease))
            .replace(version, encodeURIComponent(toRelease)),
          query: {...location.query, activeRepo: undefined},
        }
      : undefined;
  }

  function trackPaginationClick(direction: 'older' | 'newer') {
    trackAnalytics('release_detail.pagination', {organization, direction});
  }

  const releasePath = makeReleasesPathname({
    organization,
    path: `/${encodeURIComponent(version)}/`,
  });

  const tabs = [
    {title: t('Overview'), to: ''},
    {
      title: tct('Commits [count]', {
        count: (
          <ResponsiveNavTabsBadge>
            {formatAbbreviatedNumber(commitCount)}
          </ResponsiveNavTabsBadge>
        ),
      }),
      textValue: t('Commits %s', formatAbbreviatedNumber(commitCount)),
      to: 'commits/',
    },
    {
      title: tct('Files Changed [count]', {
        count: (
          <ResponsiveNavTabsBadge>
            {formatAbbreviatedNumber(commitFilesChanged)}
          </ResponsiveNavTabsBadge>
        ),
      }),
      textValue: t('Files Changed %s', formatAbbreviatedNumber(commitFilesChanged)),
      to: 'files-changed/',
    },
  ];

  const numberOfMobileBuilds = releaseMeta.preprodBuildCount;

  const buildsTab = {
    title: tct('Mobile Builds [count]', {
      count:
        numberOfMobileBuilds === 0 ? (
          <BadgeWrapper>
            <FeatureBadge type="new" />
          </BadgeWrapper>
        ) : (
          <Fragment>
            <ResponsiveNavTabsBadge>
              {formatAbbreviatedNumber(numberOfMobileBuilds)}
            </ResponsiveNavTabsBadge>
            <BadgeWrapper>
              <FeatureBadge type="new" />
            </BadgeWrapper>
          </Fragment>
        ),
    }),
    textValue: t('Mobile Builds %s', numberOfMobileBuilds),
    to: 'builds/',
  };

  if (numberOfMobileBuilds || isMobileRelease(project.platform, false)) {
    tabs.push(buildsTab);
  }

  const getTabUrl = (path: string) =>
    normalizeUrl({
      pathname: releasePath + path,
      query: pick(location.query, Object.values(URL_PARAM)),
    });

  const getActiveTabTo = () => {
    // We are not doing strict version check because there would be a tiny page shift when switching between releases with paginator
    const activeTab = tabs
      .filter(tab => tab.to.length) // remove home 'Overview' from consideration
      .find(tab => location.pathname.endsWith(tab.to));
    if (activeTab) {
      return activeTab.to;
    }

    return tabs[0]!.to; // default to 'Overview'
  };

  return (
    <Layout.Header>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Releases'),
              to: {
                pathname: makeReleasesPathname({organization, path: '/'}),
                query: extractSelectionParameters(location.query),
              },
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: formatVersion(version),
            leadingGraphic: (
              <IdBadge project={project} disableLink avatarSize={16} hideName />
            ),
            pagination: {
              previous: {
                ariaLabel: t('Older'),
                tooltip: prevReleaseVersion
                  ? t('Older release')
                  : t('This is the oldest release'),
                to: makeSiblingReleaseTarget(prevReleaseVersion),
                onClick: () => trackPaginationClick('older'),
              },
              next: {
                ariaLabel: t('Newer'),
                tooltip: nextReleaseVersion
                  ? t('Newer release')
                  : t('This is the newest release'),
                to: makeSiblingReleaseTarget(nextReleaseVersion),
                onClick: () => trackPaginationClick('newer'),
              },
            },
            trailingActions: [
              url
                ? {
                    type: 'button',
                    element: (
                      <LinkButton
                        href={url}
                        external
                        size="zero"
                        variant="transparent"
                        tooltipProps={{title: url}}
                        icon={<IconOpen />}
                        aria-label={t('Open release URL')}
                      />
                    ),
                  }
                : null,
              {
                type: 'menu',
                triggerLabel: t('Release Actions'),
                triggerIcon: <IconEllipsis />,
                items: menuItems,
              },
            ],
          }}
        />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          feedbackOptions={releaseFeedbackOptions}
          aria-label={t('Give Feedback')}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
      <Layout.HeaderTabs value={getActiveTabTo()}>
        <TabList>
          {tabs.map(tab => (
            <TabList.Item key={tab.to} to={getTabUrl(tab.to)} textValue={tab.textValue}>
              {tab.title}
            </TabList.Item>
          ))}
        </TabList>
      </Layout.HeaderTabs>
    </Layout.Header>
  );
}

function ResponsiveNavTabsBadge({children}: {children: React.ReactNode}) {
  return (
    <Container as="span" display={{zero: 'none', xl: 'inline-flex'}}>
      <Badge variant="muted">{children}</Badge>
    </Container>
  );
}

const BadgeWrapper = styled('div')`
  margin-left: 0;
`;
