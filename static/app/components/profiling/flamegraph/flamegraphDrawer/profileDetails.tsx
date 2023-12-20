import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {DeviceContextKey, EventTransaction} from 'sentry/types/event';
import {formatVersion} from 'sentry/utils/formatters';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  useResizableDrawer,
  UseResizableDrawerOptions,
} from 'sentry/utils/useResizableDrawer';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';

import {ProfilingDetailsFrameTabs, ProfilingDetailsListItem} from './flamegraphDrawer';

function renderValue(
  key: string,
  value: number | string | undefined,
  profileGroup?: ProfileGroup
) {
  if (key === 'threads' && value === undefined) {
    return profileGroup?.profiles.length;
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
  const [detailsTab, setDetailsTab] = useState<'environment' | 'transaction'>(
    'environment'
  );

  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(
    p => p.id === String(props.profileGroup.metadata.projectID)
  );

  const onEnvironmentTabClick = useCallback(() => {
    setDetailsTab('environment');
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
          className={detailsTab === 'environment' ? 'active' : undefined}
        >
          <Button
            data-title={t('Environment')}
            priority="link"
            size="zero"
            onClick={onEnvironmentTabClick}
          >
            {t('Environment')}
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

      {!props.transaction && detailsTab === 'environment' && (
        <ProfileEnvironmentDetails profileGroup={props.profileGroup} />
      )}
      {!props.transaction && detailsTab === 'transaction' && (
        <ProfileEventDetails
          organization={organization}
          profileGroup={props.profileGroup}
          project={project}
          transaction={props.transaction}
        />
      )}
      {props.transaction && detailsTab === 'environment' && (
        <TransactionDeviceDetails
          transaction={props.transaction}
          profileGroup={props.profileGroup}
        />
      )}
      {props.transaction && detailsTab === 'transaction' && (
        <TransactionEventDetails
          organization={organization}
          profileGroup={props.profileGroup}
          project={project}
          transaction={props.transaction}
        />
      )}
    </ProfileDetailsBar>
  );
}

function TransactionDeviceDetails({
  profileGroup,
  transaction,
}: {
  profileGroup: ProfileGroup;
  transaction: EventTransaction;
}) {
  const deviceDetails = useMemo(() => {
    const profileMetadata = profileGroup.metadata;
    const deviceContext = transaction.contexts.device;
    const osContext = transaction.contexts.os;

    const details: {
      key: string;
      label: string;
      value: React.ReactNode;
    }[] = [
      {
        key: 'model',
        label: t('Model'),
        value: deviceContext?.[DeviceContextKey.MODEL] ?? profileMetadata.deviceModel,
      },
      {
        key: 'manufacturer',
        label: t('Manufacturer'),
        value:
          deviceContext?.[DeviceContextKey.MANUFACTURER] ??
          profileMetadata.deviceManufacturer,
      },
      {
        key: 'classification',
        label: t('Classification'),
        value: profileMetadata.deviceClassification,
      },
      {
        key: 'name',
        label: t('OS'),
        value: osContext?.name ?? profileMetadata.deviceOSName,
      },
      {
        key: 'version',
        label: t('OS Version'),
        value: osContext?.version ?? profileMetadata.deviceOSVersion,
      },
      {
        key: 'locale',
        label: t('Locale'),
        value: profileMetadata.deviceLocale,
      },
    ];

    return details;
  }, [profileGroup, transaction]);

  return (
    <DetailsContainer>
      {deviceDetails.map(({key, label, value}) => (
        <DetailsRow key={key}>
          <strong>{label}:</strong>
          <span>{value || t('unknown')}</span>
        </DetailsRow>
      ))}
    </DetailsContainer>
  );
}

function TransactionEventDetails({
  organization,
  profileGroup,
  project,
  transaction,
}: {
  organization: Organization;
  profileGroup: ProfileGroup;
  project: Project | undefined;
  transaction: EventTransaction;
}) {
  const transactionDetails = useMemo(() => {
    const profileMetadata = profileGroup.metadata;

    const transactionTarget =
      transaction.id && project && organization
        ? getTransactionDetailsUrl(organization.slug, `${project.slug}:${transaction.id}`)
        : null;

    const details: {
      key: string;
      label: string;
      value: React.ReactNode;
    }[] = [
      {
        key: 'transaction',
        label: t('Transaction'),
        value: transactionTarget ? (
          <Link to={transactionTarget}>{transaction.title}</Link>
        ) : (
          transaction.title
        ),
      },
      {
        key: 'timestamp',
        label: t('Timestamp'),
        value: <DateTime date={transaction.startTimestamp * 1000} />,
      },
      {
        key: 'project',
        label: t('Project'),
        value: project && <ProjectBadge project={project} avatarSize={12} />,
      },
      {
        key: 'release',
        label: t('Release'),
        value: transaction.release && (
          <QuickContextHoverWrapper
            dataRow={{release: transaction.release.version}}
            contextType={ContextType.RELEASE}
            organization={organization}
          >
            <Version version={transaction.release.version} truncate />
          </QuickContextHoverWrapper>
        ),
      },
      {
        key: 'environment',
        label: t('Environment'),
        value:
          transaction.tags.find(({key}) => key === 'environment')?.value ??
          profileMetadata.environment,
      },
      {
        key: 'duration',
        label: t('Duration'),
        value: msFormatter(
          (transaction.endTimestamp - transaction.startTimestamp) * 1000
        ),
      },
      {
        key: 'threads',
        label: t('Threads'),
        value: profileGroup.profiles.length,
      },
    ];

    return details;
  }, [organization, project, profileGroup, transaction]);

  return (
    <DetailsContainer>
      {transactionDetails.map(({key, label, value}) => (
        <DetailsRow key={key}>
          <strong>{label}:</strong>
          <span>{value || t('unknown')}</span>
        </DetailsRow>
      ))}
    </DetailsContainer>
  );
}

function ProfileEnvironmentDetails({profileGroup}: {profileGroup: ProfileGroup}) {
  return (
    <DetailsContainer>
      {Object.entries(ENVIRONMENT_DETAILS_KEY).map(([label, key]) => {
        const value = profileGroup.metadata[key];
        return (
          <DetailsRow key={key}>
            <strong>{label}:</strong>
            <span>{renderValue(key, value, profileGroup)}</span>
          </DetailsRow>
        );
      })}
    </DetailsContainer>
  );
}

function ProfileEventDetails({
  organization,
  profileGroup,
  project,
  transaction,
}: {
  organization: Organization;
  profileGroup: ProfileGroup;
  project: Project | undefined;
  transaction: EventTransaction | null;
}) {
  return (
    <DetailsContainer>
      {Object.entries(PROFILE_DETAILS_KEY).map(([label, key]) => {
        const value = profileGroup.metadata[key];

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
        if (key === 'transactionName') {
          const transactionTarget =
            project?.slug && transaction?.id && organization
              ? getTransactionDetailsUrl(
                  organization.slug,
                  `${project.slug}:${transaction.id}`
                )
              : null;
          if (transactionTarget) {
            return (
              <DetailsRow key={key}>
                <strong>{label}:</strong>
                <Link to={transactionTarget}>{value}</Link>
              </DetailsRow>
            );
          }
        }
        if (key === 'projectID') {
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
          if (!organization || (Object.keys(release).length <= 1 && release.version)) {
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
                    project: profileGroup.metadata.projectID,
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
              {renderValue(key, value, profileGroup)}
            </span>
          </DetailsRow>
        );
      })}
    </DetailsContainer>
  );
}

const msFormatter = makeFormatter('milliseconds');

const PROFILE_DETAILS_KEY: Record<string, string> = {
  [t('transaction')]: 'transactionName',
  [t('received at')]: 'received',
  [t('organization')]: 'organizationID',
  [t('project')]: 'projectID',
  [t('platform')]: 'platform',
  [t('release')]: 'release',
  [t('environment')]: 'environment',
  [t('threads')]: 'threads',
};

const ENVIRONMENT_DETAILS_KEY: Record<string, string> = {
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
