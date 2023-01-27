import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import Badge from 'sentry/components/badge';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import Clipboard from 'sentry/components/clipboard';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {IconCopy, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Release, ReleaseMeta, ReleaseProject} from 'sentry/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

import ReleaseActions from './releaseActions';

type Props = {
  location: Location;
  organization: Organization;
  project: Required<ReleaseProject>;
  refetchData: () => void;
  release: Release;
  releaseMeta: ReleaseMeta;
};

const ReleaseHeader = ({
  location,
  organization,
  release,
  project,
  releaseMeta,
  refetchData,
}: Props) => {
  const {version, url} = release;
  const {commitCount, commitFilesChanged} = releaseMeta;

  const releasePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
    version
  )}/`;

  const tabs = [
    {title: t('Overview'), to: ''},
    {
      title: (
        <Fragment>
          {t('Commits')} <NavTabsBadge text={formatAbbreviatedNumber(commitCount)} />
        </Fragment>
      ),
      to: `commits/`,
    },
    {
      title: (
        <Fragment>
          {t('Files Changed')}
          <NavTabsBadge text={formatAbbreviatedNumber(commitFilesChanged)} />
        </Fragment>
      ),
      to: `files-changed/`,
    },
  ];

  const getTabUrl = (path: string) => ({
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

    return tabs[0].to; // default to 'Overview'
  };

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={[
            {
              to: `/organizations/${organization.slug}/releases/`,
              label: t('Releases'),
              preservePageFilters: true,
            },
            {label: t('Release Details')},
          ]}
        />
        <Layout.Title>
          <IdBadge project={project} avatarSize={28} hideName />
          <Version version={version} anchor={false} truncate />
          <IconWrapper>
            <Tooltip title={version} containerDisplayMode="flex">
              <Clipboard value={version}>
                <IconCopy />
              </Clipboard>
            </Tooltip>
          </IconWrapper>
          {!!url && (
            <IconWrapper>
              <Tooltip title={url}>
                <ExternalLink href={url}>
                  <IconOpen />
                </ExternalLink>
              </Tooltip>
            </IconWrapper>
          )}
        </Layout.Title>
      </Layout.HeaderContent>

      <Layout.HeaderActions>
        <ReleaseActions
          organization={organization}
          projectSlug={project.slug}
          release={release}
          releaseMeta={releaseMeta}
          refetchData={refetchData}
          location={location}
        />
      </Layout.HeaderActions>

      <Fragment>
        <StyledNavTabs>
          {tabs.map(tab => (
            <ListLink
              key={tab.to}
              to={getTabUrl(tab.to)}
              isActive={() => getActiveTabTo() === tab.to}
            >
              {tab.title}
            </ListLink>
          ))}
        </StyledNavTabs>
      </Fragment>
    </Layout.Header>
  );
};

const IconWrapper = styled('span')`
  transition: color 0.3s ease-in-out;

  &,
  a {
    color: ${p => p.theme.gray300};
    display: flex;
    &:hover {
      cursor: pointer;
      color: ${p => p.theme.textColor};
    }
  }
`;

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
  /* Makes sure the tabs are pushed into another row */
  width: 100%;
`;

const NavTabsBadge = styled(Badge)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

export default ReleaseHeader;
