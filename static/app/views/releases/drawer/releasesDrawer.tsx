import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {PlatformList} from 'sentry/components/platformList';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerList} from 'sentry/views/releases/drawer/releasesDrawerList';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {useReleaseDetails} from 'sentry/views/releases/utils/useReleaseDetails';

type Without<T, U> = {[P in Exclude<keyof T, keyof U>]?: never};
type XOR<T, Tcopy> =
  T extends Record<PropertyKey, unknown> ? Without<Exclude<Tcopy, T>, T> & T : T;

type ReleasesDrawerListProps = Omit<
  React.ComponentProps<typeof ReleasesDrawerList>,
  'onSelectRelease'
>;
type ListProps = ReleasesDrawerListProps;
type DetailsProps = {release: string};
type ReleasesDrawerProps = XOR<ListProps, DetailsProps>;

/**
 * The container for the Releases Drawer. Handles displaying either the
 * releases list or details.
 */
export function ReleasesDrawer({
  release,
  releases,
  ...releasesDrawerListProps
}: ReleasesDrawerProps) {
  const organization = useOrganization();
  const [selectedRelease, setSelectedRelease] = useState<{
    projectId: string;
    release: string;
  } | null>(null);
  const releaseOrSelected = release || selectedRelease?.release;
  const releaseDetailsQuery = useReleaseDetails(
    {release: releaseOrSelected!},
    {enabled: !!releaseOrSelected}
  );
  const {closeDrawer} = useDrawer();
  const crumbs = [
    {
      // This is just temporary until we move to URL based nav for this drawer
      label: (
        <div
          style={{cursor: selectedRelease?.release ? 'pointer' : 'default'}}
          onClick={() => {
            if (selectedRelease?.release) {
              setSelectedRelease(null);
            }
          }}
        >
          {t('Releases')}
        </div>
      ),
    },
    ...(releaseOrSelected ? [{label: formatVersion(releaseOrSelected)}] : []),
  ];

  const title = releaseOrSelected ? (
    <ReleaseWithPlatform>
      <PlatformList
        platforms={releaseDetailsQuery.data?.projects.map(({platform}) => platform)}
      />
      {formatVersion(releaseOrSelected)}
    </ReleaseWithPlatform>
  ) : (
    tn('%s Release', '%s Releases', releases.length ?? 0)
  );

  const handleSelectRelease = useCallback(
    (nextSelectedRelease: string, projectId: string) => {
      setSelectedRelease({release: nextSelectedRelease, projectId});
    },
    []
  );

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={crumbs} />
      </EventDrawerHeader>
      <EventNavigator>
        <HeaderToolbar>
          {title}

          {releaseOrSelected && (
            <Button
              to={normalizeUrl({
                pathname: makeReleasesPathname({
                  path: `/${encodeURIComponent(releaseOrSelected)}/`,
                  organization,
                }),
                query: {
                  project: selectedRelease?.projectId,
                },
              })}
              size="xs"
              onClick={() => {
                closeDrawer();
                trackAnalytics('releases.drawer_view_full_details', {
                  organization: organization.id,
                  project_id: String(selectedRelease!.projectId),
                });
              }}
            >
              {t('View Full Details')}
            </Button>
          )}
        </HeaderToolbar>
      </EventNavigator>
      <EventDrawerBody>
        {releaseOrSelected ? (
          <ReleasesDrawerDetails
            projectId={selectedRelease?.projectId}
            release={releaseOrSelected}
          />
        ) : (
          <ReleasesDrawerList
            releases={releases}
            {...releasesDrawerListProps}
            onSelectRelease={handleSelectRelease}
          />
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const ReleaseWithPlatform = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const HeaderToolbar = styled(Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
