import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {EventTransaction} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import useProjects from 'sentry/utils/useProjects';
import {
  useResizableDrawer,
  UseResizableDrawerOptions,
} from 'sentry/utils/useResizableDrawer';

import {ProfilingDetailsFrameTabs, ProfilingDetailsListItem} from './flamegraphDrawer';

function renderValue(
  key: string,
  value: number | string | undefined,
  profileGroup: ProfileGroup
) {
  if (key === 'durationNS' && typeof value === 'number') {
    return nsFormatter(value);
  }
  if (key === 'threads') {
    return profileGroup.profiles.length;
  }
  if (key === 'received') {
    return <DateTime date={value} />;
  }
  if (value === undefined || value === '') {
    return t('ø');
  }

  return value;
}

interface ProfileDetailsProps {
  profileGroup: ProfileGroup;
  projectId: string;
  transaction: EventTransaction | null;
}

export function ProfileDetails(props: ProfileDetailsProps) {
  const [detailsTab, setDetailsTab] = useState<'device' | 'transaction'>('transaction');

  const organizations = useLegacyStore(OrganizationsStore);
  const {projects} = useProjects();

  const onDeviceTabClick = useCallback(() => {
    setDetailsTab('device');
  }, []);

  const onTransactionTabClick = useCallback(() => {
    setDetailsTab('transaction');
  }, []);

  const flamegraphPreferences = useFlamegraphPreferences();
  const isResizableDetailsBar =
    flamegraphPreferences.layout === 'table left' ||
    flamegraphPreferences.layout === 'table right';

  const detailsBarRef = useRef<HTMLDivElement>(null);

  const resizableOptions: UseResizableDrawerOptions = useMemo(() => {
    const isSidebarLayout =
      flamegraphPreferences.layout === 'table left' ||
      flamegraphPreferences.layout === 'table right';

    // Only used when in sidebar layout
    const initialSize = isSidebarLayout ? 260 : 0;

    const onResize = (newSize: number, maybeOldSize?: number) => {
      if (!detailsBarRef.current) {
        return;
      }

      if (isSidebarLayout) {
        detailsBarRef.current.style.width = `100%`;
        detailsBarRef.current.style.height = `${maybeOldSize ?? newSize}px`;
      } else {
        detailsBarRef.current.style.height = '';
        detailsBarRef.current.style.width = '';
      }
    };

    return {
      initialSize,
      onResize,
      direction: isSidebarLayout ? 'up' : 'left',
      min: 26,
    };
  }, [flamegraphPreferences.layout]);

  const {onMouseDown, onDoubleClick} = useResizableDrawer(resizableOptions);

  const organization = organizations.find(
    o => o.id === String(props.profileGroup.metadata.organizationID)
  );

  const projectSlug = props.projectId ?? '';

  const transactionTarget =
    props.transaction?.id && organization
      ? getTransactionDetailsUrl(
          organization.slug,
          `${projectSlug}:${props.transaction.id}`
        )
      : null;

  return (
    <ProfileDetailsBar ref={detailsBarRef} layout={flamegraphPreferences.layout}>
      <ProfilingDetailsFrameTabs>
        <ProfilingDetailsListItem
          size="sm"
          className={detailsTab === 'transaction' ? 'active' : undefined}
        >
          <Button
            data-title={t('Transaction')}
            priority="link"
            size="zero"
            onClick={onTransactionTabClick}
          >
            {t('Transaction')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          size="sm"
          className={detailsTab === 'device' ? 'active' : undefined}
        >
          <Button
            data-title={t('Device')}
            priority="link"
            size="zero"
            onClick={onDeviceTabClick}
          >
            {t('Device')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          style={{
            flex: '1 1 100%',
            cursor: isResizableDetailsBar ? 'ns-resize' : undefined,
          }}
          onMouseDown={isResizableDetailsBar ? onMouseDown : undefined}
          onDoubleClick={isResizableDetailsBar ? onDoubleClick : undefined}
        />
      </ProfilingDetailsFrameTabs>

      {detailsTab === 'device' ? (
        <DetailsContainer>
          {Object.entries(DEVICE_DETAILS_KEY).map(([label, key]) => {
            const value = props.profileGroup.metadata[key];
            return (
              <DetailsRow key={key}>
                <strong>{label}:</strong>
                <span>{renderValue(key, value, props.profileGroup)}</span>
              </DetailsRow>
            );
          })}
        </DetailsContainer>
      ) : (
        <DetailsContainer>
          {Object.entries(PROFILE_DETAILS_KEY).map(([label, key]) => {
            const value = props.profileGroup.metadata[key];

            if (key === 'organizationID') {
              if (organization) {
                return (
                  <DetailsRow key={key}>
                    <strong>{label}:</strong>
                    <Link to={`/organizations/${organization.slug}/projects/`}>
                      <span>
                        <OrganizationAvatar size={12} organization={organization} />{' '}
                        {organization.name}
                      </span>
                    </Link>
                  </DetailsRow>
                );
              }
            }
            if (key === 'transactionName' && transactionTarget) {
              return (
                <DetailsRow key={key}>
                  <strong>{label}:</strong>
                  <Link to={transactionTarget}>{value}</Link>
                </DetailsRow>
              );
            }
            if (key === 'projectID') {
              const project = projects.find(p => p.id === String(value));
              if (project && organization) {
                return (
                  <DetailsRow key={key}>
                    <strong>{label}:</strong>
                    <Link
                      to={`/organizations/${organization.slug}/projects/${project.slug}/?project=${project.id}`}
                    >
                      <FlexRow>
                        <ProjectAvatar project={project} size={12} /> {project.slug}
                      </FlexRow>
                    </Link>
                  </DetailsRow>
                );
              }
            }

            if (key === 'release' && value) {
              const release = value;

              // If a release only contains a version key, then we cannot link to it and
              // fallback to just displaying the raw version value.
              if (
                !organization ||
                (Object.keys(release).length <= 1 && release.version)
              ) {
                return (
                  <DetailsRow key={key}>
                    <strong>{label}:</strong>
                    <span>{formatVersion(release.version)}</span>
                  </DetailsRow>
                );
              }
              return (
                <DetailsRow key={key}>
                  <strong>{label}:</strong>
                  <Link
                    to={{
                      pathname: `/organizations/${
                        organization.slug
                      }/releases/${encodeURIComponent(release.version)}/`,
                      query: {
                        project: props.profileGroup.metadata.projectID,
                      },
                    }}
                  >
                    {formatVersion(release.version)}
                  </Link>
                </DetailsRow>
              );
            }

            // This final fallback is only capabable of rendering a string/undefined/null.
            // If the value is some other type, make sure not to let it reach here.
            return (
              <DetailsRow key={key}>
                <strong>{label}:</strong>
                <span>
                  {key === 'platform' ? (
                    <Fragment>
                      <PlatformIcon size={12} platform={value ?? 'unknown'} />{' '}
                    </Fragment>
                  ) : null}
                  {renderValue(key, value, props.profileGroup)}
                </span>
              </DetailsRow>
            );
          })}
          <DetailsRow />
        </DetailsContainer>
      )}
    </ProfileDetailsBar>
  );
}

const nsFormatter = makeFormatter('nanoseconds');

const PROFILE_DETAILS_KEY: Record<string, string> = {
  [t('transaction')]: 'transactionName',
  [t('received at')]: 'received',
  [t('organization')]: 'organizationID',
  [t('project')]: 'projectID',
  [t('platform')]: 'platform',
  [t('release')]: 'release',
  [t('environment')]: 'environment',
  [t('duration')]: 'durationNS',
  [t('threads')]: 'threads',
};

const DEVICE_DETAILS_KEY: Record<string, string> = {
  [t('model')]: 'deviceModel',
  [t('manufacturer')]: 'deviceManufacturer',
  [t('classification')]: 'deviceClassification',
  [t('os')]: 'deviceOSName',
  [t('os version')]: 'deviceOSVersion',
  [t('locale')]: 'deviceLocale',
};

// ProjectAvatar is contained in a div
const FlexRow = styled('span')`
  display: inline-flex;
  align-items: center;

  > div {
    margin-right: ${space(0.5)};
  }
`;

const DetailsRow = styled('div')`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};

  > span,
  > a {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  > strong {
    margin-right: ${space(0.5)};
  }
`;

const DetailsContainer = styled('div')`
  padding: ${space(1)};
  margin: 0;
  overflow: auto;
  position: absolute;
  left: 0;
  top: 24px;
  width: 100%;
  height: calc(100% - 24px);
`;

const ProfileDetailsBar = styled('div')<{layout: FlamegraphPreferences['layout']}>`
  width: ${p =>
    p.layout === 'table left' || p.layout === 'table right' ? '100%' : '260px'};
  height: ${p =>
    p.layout === 'table left' || p.layout === 'table right' ? '220px' : '100%'};
  border-left: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  grid-area: details;
  position: relative;

  > ul:first-child {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;
