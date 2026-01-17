import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {ExternalLink} from 'sentry/components/core/link';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import configStore from 'sentry/stores/configStore';
import type {Release} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

function makeReleaseOption(
  release: Release,
  currentUserEmail?: string
): SelectOption<string> {
  const isAuthor = release.authors?.some(
    author => author.email && author.email === currentUserEmail
  );

  return {
    value: release.version,
    label: (
      <span>
        {release.versionInfo?.package && (
          <Fragment>{release.versionInfo.package}@</Fragment>
        )}
        <Version version={release.version} anchor={false} />{' '}
        {isVersionInfoSemver(release.versionInfo.version)
          ? t('(semver)')
          : t('(non-semver)')}
      </span>
    ),
    textValue: release.versionInfo?.package
      ? `${release.versionInfo.package}@${release.version}`
      : release.version,
    details: (
      <span>
        {t('Created')} <TimeSince date={release.dateCreated} />
        {isAuthor ? <Fragment> — {t('You committed')}</Fragment> : null}
      </span>
    ),
  };
}

interface CustomResolutionModalProps extends ModalRenderProps {
  onSelected: (change: {inRelease: string}) => void;
  projectSlug: string | undefined;
}

function CustomResolutionModal(props: CustomResolutionModalProps) {
  const organization = useOrganization();
  const [version, setVersion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const currentUser = configStore.get('user');
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const releaseListUrl = props.projectSlug
    ? getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/', {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: props.projectSlug,
        },
      })
    : getApiUrl('/organizations/$organizationIdOrSlug/releases/', {
        path: {organizationIdOrSlug: organization.slug},
      });

  const {data: releases = [], isFetching} = useApiQuery<Release[]>(
    [
      releaseListUrl,
      {
        query: {
          query: debouncedSearch,
        },
      },
    ],
    {
      staleTime: 60_000,
      retry: false,
    }
  );

  const shouldLookupExact = debouncedSearch.trim().length > 0;

  // Attempt to find the exact release, the list is capped at the most recent 100 releases
  const {data: exactRelease} = useApiQuery<Release>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/releases/$version/', {
        path: {organizationIdOrSlug: organization.slug, version: debouncedSearch.trim()},
      }),
    ],
    {
      enabled: shouldLookupExact,
      staleTime: 30_000,
      retry: false,
    }
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const baseOptions = releases.map(release =>
      makeReleaseOption(release, currentUser?.email)
    );

    if (exactRelease) {
      const exactOption: (typeof baseOptions)[number] = makeReleaseOption(
        exactRelease,
        currentUser?.email
      );

      const filtered = baseOptions.filter(opt => opt.value !== exactOption.value);
      filtered.unshift(exactOption);
      return filtered;
    }

    return baseOptions;
  }, [currentUser?.email, exactRelease, releases]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) {
      setSelectionError(t('Please select a release.'));
      return;
    }

    setSearchQuery('');
    setSelectionError(null);
    props.onSelected({inRelease: version});
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
          searchable
          disableSearchFilter
          options={options}
          value={version}
          loading={isFetching}
          searchPlaceholder={t('Search versions')}
          emptyMessage={isFetching ? t('Loading releases\u2026') : t('No releases found')}
          onSearch={setSearchQuery}
          onChange={option => {
            setVersion(option?.value ? String(option.value) : '');
            setSelectionError(null);
            setSearchQuery('');
          }}
          menuTitle={t('Version')}
          menuWidth={548}
          triggerProps={{
            prefix: t('Version'),
            'aria-label': t('Version'),
            children: version
              ? undefined
              : isFetching
                ? t('Loading\u2026')
                : t('Select a version'),
          }}
          onClose={() => setSearchQuery('')}
        />
        {selectionError ? <ErrorText role="alert">{selectionError}</ErrorText> : null}
        <ReleaseLinkWrapper>
          {version ? (
            // Open release in new tab to avoid closing the modal
            <ExternalLink
              href={normalizeUrl(
                `/organizations/${organization.slug}/releases/${encodeURIComponent(version)}/${
                  props.projectSlug ? `?project=${props.projectSlug}` : ''
                }`
              )}
              openInNewTab
            >
              <Flex align="center" gap="xs">
                {t('View release')} <IconOpen size="xs" />
              </Flex>
            </ExternalLink>
          ) : (
            // Placeholder to maintain layout when no version is selected
            <PlaceholderLink aria-hidden="true" />
          )}
        </ReleaseLinkWrapper>
      </Body>
      <Footer>
        <Flex gap="sm" align="center" justify="end">
          <Button onClick={props.closeModal}>{t('Cancel')}</Button>
          <Button type="submit" priority="primary">
            {t('Resolve')}
          </Button>
        </Flex>
      </Footer>
    </form>
  );
}

export default CustomResolutionModal;

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  > button {
    width: 100%;
  }
`;

const ReleaseLinkWrapper = styled('div')`
  margin-top: ${p => p.theme.space.md};
`;

const PlaceholderLink = styled('span')`
  display: inline-block;
  min-height: 1.2em;
`;

const ErrorText = styled('div')`
  color: ${p => p.theme.tokens.content.danger};
  margin-top: ${p => p.theme.space.sm};
`;
