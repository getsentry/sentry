import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import PlatformList from 'sentry/components/platformList';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerList} from 'sentry/views/releases/drawer/releasesDrawerList';
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
  const [selectedRelease, setSelectedRelease] = useState<{
    projectId: string;
    release: string;
  } | null>(null);
  const releaseOrSelected = release || selectedRelease?.release;
  const releaseDetailsQuery = useReleaseDetails(
    {release: releaseOrSelected!},
    {enabled: !!releaseOrSelected}
  );
  const crumbs = [
    {label: t('Releases'), to: '#'},
    ...(releaseOrSelected ? [{label: releaseOrSelected, to: '#'}] : []),
  ];
  const title =
    releaseOrSelected && releaseDetailsQuery.data ? (
      <ReleaseWithPlatform>
        <PlatformList
          platforms={releaseDetailsQuery.data.projects.map(({platform}) => platform)}
        />
        {releaseOrSelected}
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
        <Header>{title}</Header>
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
