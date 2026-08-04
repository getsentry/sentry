import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Flex, Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/explore/releases/utils';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

function canLookupExactRelease(version: string): boolean {
  return version.length > 0 && !/^\.\.?$/.test(version);
}

function makeReleaseOption(
  release: Release,
  currentUserEmail: string | undefined
): SelectOption<string> {
  const isAuthor = release.authors?.some(
    author => author.email && author.email === currentUserEmail
  );
  const isSemver = release.versionInfo
    ? isVersionInfoSemver(release.versionInfo.version)
    : false;

  return {
    value: release.version,
    label: (
      <span>
        {release.versionInfo?.package && (
          <Fragment>{release.versionInfo.package}@</Fragment>
        )}
        <Version version={release.version} anchor={false} />{' '}
        {isSemver ? t('(semver)') : t('(non-semver)')}
      </span>
    ),
    textValue: release.version,
    details: (
      <span>
        {t('Created')} <TimeSince date={release.dateCreated} />
        {isAuthor ? <Fragment> — {t('You committed')}</Fragment> : null}
      </span>
    ),
  };
}

function getUniqueReleases(releases: Array<Release | null | undefined>): Release[] {
  const seen = new Set<string>();

  return releases.filter((release): release is Release => {
    if (!release || seen.has(release.version)) {
      return false;
    }

    seen.add(release.version);
    return true;
  });
}

interface CustomResolutionModalProps extends ModalRenderProps {
  onSelected: (change: {inRelease: string}) => void;
  project: Project | undefined;
}

export function CustomResolutionModal(props: CustomResolutionModalProps) {
  const organization = useOrganization();
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const currentUser = ConfigStore.get('user');
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const {data: releases = [], isFetching} = useQuery({
    ...apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {project: props.project?.id, query: debouncedSearch},
      staleTime: 60_000,
    }),
    retry: false,
  });

  const exactSearch = debouncedSearch.trim();
  const shouldLookupExact = canLookupExactRelease(exactSearch);

  // Attempt to find the exact release, the list is capped at the most recent 100 releases
  const {data: exactReleaseResponse} = useQuery({
    ...apiOptions.as<Release | Release[]>()(
      '/organizations/$organizationIdOrSlug/releases/$version/',
      {
        path: shouldLookupExact
          ? {
              organizationIdOrSlug: organization.slug,
              version: exactSearch,
            }
          : skipToken,
        staleTime: 30_000,
      }
    ),
    retry: false,
  });
  // Guard against intermediaries normalizing the detail URL to the releases collection.
  const exactRelease = Array.isArray(exactReleaseResponse)
    ? undefined
    : exactReleaseResponse;

  const visibleReleases = useMemo(
    () =>
      getUniqueReleases(
        exactSearch ? [exactRelease, ...releases] : [selectedRelease, ...releases]
      ),
    [exactRelease, exactSearch, releases, selectedRelease]
  );

  const options = useMemo(
    (): Array<SelectOption<string>> =>
      visibleReleases.map(release => makeReleaseOption(release, currentUser?.email)),
    [currentUser?.email, visibleReleases]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelease) {
      setSelectionError(t('Please select a release.'));
      return;
    }

    setSearchQuery('');
    setSelectionError(null);
    props.onSelected({inRelease: selectedRelease.version});
    props.closeModal();
  };
  const {Header, Body, Footer} = props;

  return (
    <form onSubmit={onSubmit}>
      <Header>
        <h4>{t('Resolved In')}</h4>
      </Header>
      <Body>
        <StyledCompactSelect
          id="version"
          clearable
          search={{
            placeholder: t('Search versions'),
            filter: false,
            onChange: setSearchQuery,
          }}
          options={options}
          value={selectedRelease?.version ?? ''}
          loading={isFetching}
          emptyMessage={isFetching ? t('Loading releases\u2026') : t('No releases found')}
          onChange={option => {
            const selectedVersion = option?.value ? String(option.value) : '';
            const release =
              visibleReleases.find(item => item.version === selectedVersion) ?? null;

            setSelectedRelease(release);
            setSelectionError(null);
            setSearchQuery('');
          }}
          menuTitle={t('Version')}
          menuWidth={548}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              prefix={t('Version')}
              aria-label={t('Version')}
            >
              {selectedRelease
                ? triggerProps.children
                : isFetching
                  ? t('Loading\u2026')
                  : t('Select a version')}
            </OverlayTrigger.Button>
          )}
          onClose={() => setSearchQuery('')}
        />
        {selectionError ? <ErrorText role="alert">{selectionError}</ErrorText> : null}
        <Container marginTop="md">
          {selectedRelease ? (
            // Open release in new tab to avoid closing the modal
            <ExternalLink
              href={`${makeReleasesPathname({
                organization,
                path: `/${encodeURIComponent(selectedRelease.version)}/`,
              })}${props.project ? `?project=${props.project.id}` : ''}`}
              openInNewTab
            >
              <Flex align="center" gap="xs">
                {t('View release')} <IconOpen size="xs" />
              </Flex>
            </ExternalLink>
          ) : (
            // Placeholder to maintain layout when no version is selected
            <Container
              as="span"
              display="inline-block"
              minHeight="1.2em"
              aria-hidden="true"
            />
          )}
        </Container>
      </Body>
      <Footer>
        <Flex gap="sm" align="center" justify="end">
          <Button onClick={props.closeModal}>{t('Cancel')}</Button>
          <Button type="submit" variant="primary">
            {t('Resolve')}
          </Button>
        </Flex>
      </Footer>
    </form>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  > button {
    width: 100%;
  }
`;

const ErrorText = styled('div')`
  color: ${p => p.theme.tokens.content.danger};
  margin-top: ${p => p.theme.space.sm};
`;
