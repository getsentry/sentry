import {useState} from 'react';
import moment from 'moment-timezone';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {Link} from 'sentry/components/core/link';
import UserBadge from 'sentry/components/idBadge/userBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Truncate from 'sentry/components/truncate';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import CustomerName from 'admin/components/customerName';
import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import type {ActionItem} from 'admin/components/detailsPage';
import DetailsPage from 'admin/components/detailsPage';
import RelocationAbortModal from 'admin/components/relocationAbortModal';
import RelocationBadge from 'admin/components/relocationBadge';
import RelocationCancelModal from 'admin/components/relocationCancelModal';
import RelocationPauseModal from 'admin/components/relocationPauseModal';
import RelocationRetryModal from 'admin/components/relocationRetryModal';
import RelocationUnpauseModal from 'admin/components/relocationUnpauseModal';
import ResultGrid from 'admin/components/resultGrid';
import type {Relocation} from 'admin/types';
import {RelocationSteps} from 'admin/types';
import titleCase from 'getsentry/utils/titleCase';

enum ArtifactsState {
  DISABLED = 0,
  FETCHING = 1,
  FETCHED = 2,
  ERROR = 3,
}

type RelocationArtifact = {
  description: string;
  path: string;
  regionName: string;
  relocation: Relocation;
  sizeInKbs: number;
};

// A map of each expected relocation artifact to a user-legible description of what it is.
const expectedRelocationArtifacts: Map<string, string> = new Map(
  Object.entries({
    'conf/cloudbuild.yaml':
      'The execution script that Google CloudBuild will run when validating this relocation.',
    'in/kms-config.json':
      'The KMS configuration that the CloudBuild tasks will use when they need to encryption/decryption of the various artifacts.',
    'in/baseline-config.tar':
      'An encrypted copy of the production server\'s "baseline" configuration, such as global options, integrations, and so on.',
    'in/filter-usernames.txt.tar':
      'All username collisions between those that the user requested to import and those already on SaaS.',
    'findings/import-baseline-config.json':
      'Error reports generated when attempting to import the baseline configuration during validation.',
    'in/colliding-users.tar':
      'An encrypted copy of the full user information for any imported users whose usernames matches one that was requested in the import. Note that this is not ALL users - only those with a username overlap.',
    'findings/import-colliding-users.json':
      'Error reports generated when attempting to import colliding users during validation.',
    'in/raw-relocation-data.tar':
      'The encrypted relocation data that was provided by the relocating user themselves.',
    'findings/import-raw-relocation-data.json':
      "Error reports generated when attempting to import the user's relocation data during validation.",
    'out/baseline-config.tar':
      'An encrypted copy of the baseline configuration after it has been imported and re-exported. This is used by the validation script to ensure that this data was not mutated when the user data was imported.',
    'findings/export-baseline-config.json':
      'Error reports generated when attempting to re-export the baseline configuration during validation.',
    'out/colliding-users.tar':
      'An encrypted copy of the colliding users after they have been imported and re-exported. This is used by the validation script to ensure that this data was not mutated when the user data was imported.',
    'findings/export-colliding-users.json':
      'Error reports generated when attempting to re-export colliding users during validation.',
    'findings/compare-baseline-config.json':
      'Error reports generated when comparing the imported baseline config with its re-exported matching pair during validation.',
    'findings/compare-colliding-users.json':
      'Error reports generated when comparing the imported baseline config with its re-exported matching pair during validation.',
  })
);

// Just the list order for the above artifacts - makes them a bit easier to read, since it is
// roughly chronological from the perspective of CloudBuild validation.
const orderedRelocationArtifacts = [
  'conf/cloudbuild.yaml',
  'findings/import-baseline-config.json',
  'findings/import-colliding-users.json',
  'findings/import-raw-relocation-data.json',
  'findings/export-baseline-config.json',
  'findings/export-colliding-users.json',
  'findings/compare-baseline-config.json',
  'findings/compare-colliding-users.json',
  'in/baseline-config.tar',
  'in/colliding-users.tar',
  'in/kms-config.json',
  'in/raw-relocation-data.tar',
  'out/baseline-config.tar',
  'out/colliding-users.tar',
];

const getArtifactRow = (row: RelocationArtifact) => [
  <td key="file">
    <strong>
      <Link
        to={`/_admin/relocations/${row.regionName}/${row.relocation.uuid}/${row.path}/`}
      >
        {row.path}
      </Link>
    </strong>
  </td>,
  <td key="size" style={{textAlign: 'center'}}>
    {row.sizeInKbs} KB
  </td>,
  <td key="description" style={{textAlign: 'left'}}>
    {row.description}
  </td>,
];

const getOrgRow = (row: Organization) => [
  <td key="customer">
    <CustomerName>
      <OrganizationAvatar size={36} organization={row as any} />
      <div>
        <strong>
          <Link to={`/_admin/customers/${row.slug}/`}>{row.name}</Link>
        </strong>
        <small> — {row.slug}</small>
      </div>
    </CustomerName>
  </td>,
  <td key="joined" style={{textAlign: 'right'}}>
    {moment(row.dateCreated).format('MMMM YYYY')}
    <br />
    <small>{moment(row.dateCreated).fromNow()}</small>
  </td>,
];

const getUserRow = (row: any) => [
  <td key="user">
    <Link to={`/_admin/users/${row.id}/`}>
      <UserBadge
        hideEmail
        user={row}
        displayName={<Truncate maxLength={40} value={row.name} />}
      />
    </Link>
  </td>,
  <td key="email" style={{textAlign: 'center'}}>
    {row.username}
    <br />
    {row.username !== row.email && row.email}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    {row.isActive ? 'Active' : 'Disabled'}
  </td>,
  <td key="joined" style={{textAlign: 'right'}}>
    {moment(row.dateJoined).fromNow()}
  </td>,
];

function RelocationDetails() {
  const {regionName, relocationUuid} = useParams<{
    regionName: string;
    relocationUuid: string;
  }>();
  const [artifactsState, setArtifactsState] = useState<ArtifactsState>(
    ArtifactsState.DISABLED
  );
  const navigate = useNavigate();

  const region = ConfigStore.get('regions').find((r: any) => r.name === regionName);
  const regionClient = new Client({baseUrl: `${region?.url || ''}/api/0`});
  const regionApi = useApi({api: regionClient});

  const {data, isPending, isError, refetch} = useApiQuery<Relocation>(
    [`/relocations/${relocationUuid}/`, {host: region ? region.url : ''}],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const relocationData = {
    ...data,
    region: ConfigStore.get('regions').find((r: any) => r.name === regionName) || {
      name: regionName,
      url: '',
    },
  };

  const handleDataUpdate = () => {
    refetch();
  };

  const renderActions = () => {
    const actions: ActionItem[] = [];

    if (
      artifactsState === ArtifactsState.DISABLED ||
      artifactsState === ArtifactsState.ERROR
    ) {
      actions.push({
        key: 'artifacts',
        name: `Show Artifacts`,
        help: `Show all artifacts (files, findings, etc) associated with this relocation for further review. You may need special admin privileges to use this feature.`,
        skipConfirmModal: true,
        onAction: () => {
          // artifact state is either disabled or error
          clearIndicators();
          addLoadingMessage('Loading artifacts list...');
          setArtifactsState(ArtifactsState.FETCHING);
        },
      });
    }

    // There are no actions for a relocation that has already succeeded.
    if (relocationData.status === 'SUCCESS') {
      return actions;
    }

    // Only one possible action for a failed relocation.
    if (relocationData.status === 'FAILURE') {
      actions.push({
        key: 'retry',
        name: 'Retry',
        help: 'Retry this relocation.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationRetryModal
              {...deps}
              relocation={relocationData}
              onSuccess={(rawRelocation: Relocation) => {
                navigate(
                  `/_admin/relocations/${relocationData.region.name}/${rawRelocation.uuid}/`
                );
              }}
            />
          ));
        },
      });
      return actions;
    }

    // In progress relocations may be paused, unless we are on the penultimate step.
    if (relocationData.status === 'IN_PROGRESS' && relocationData.step !== 'NOTIFYING') {
      actions.push({
        key: 'pause',
        name: 'Schedule Pause',
        help: 'Specify the step prior to which this relocation will be autopaused.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationPauseModal
              {...deps}
              relocation={relocationData}
              onSuccess={() => {
                handleDataUpdate();
              }}
            />
          ));
        },
      });
    }

    // A paused relocation, or one that already has a pause scheduled, can be unpaused.
    const hasScheduledPause =
      relocationData.status === 'IN_PROGRESS' &&
      relocationData.scheduledPauseAtStep !== null;
    if (relocationData.status === 'PAUSE' || hasScheduledPause) {
      actions.push({
        key: 'unpause',
        name: 'Unpause',
        help: 'Disable an active or scheduled autopause.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationUnpauseModal
              {...deps}
              relocation={relocationData}
              onSuccess={() => {
                handleDataUpdate();
              }}
            />
          ));
        },
      });
    }

    // Relocations may be cancelled, unless we are on the penultimate step.
    if (relocationData.step !== 'NOTIFYING') {
      actions.push({
        key: 'cancel',
        name: 'Schedule Cancellation',
        help: 'Schedule the orderly cancellation of an in-progress relocation.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationCancelModal
              {...deps}
              relocation={relocationData}
              onSuccess={() => {
                handleDataUpdate();
              }}
            />
          ));
        },
      });
    }

    actions.push({
      key: 'abort',
      name: 'Abort',
      help: 'Immediately kill the in-progress relocation - this can be dangerous!',
      skipConfirmModal: true,
      onAction: () => {
        openModal(deps => (
          <RelocationAbortModal
            {...deps}
            relocation={relocationData}
            onSuccess={() => {
              handleDataUpdate();
            }}
          />
        ));
      },
    });

    return actions;
  };

  const renderOverview = () => {
    return (
      <DetailsContainer>
        <DetailList>
          <DetailLabel title="Provenance">
            <code>{relocationData.provenance}</code>
          </DetailLabel>
          <DetailLabel title="Region">
            <code>{regionName}</code>
          </DetailLabel>
          <DetailLabel title="Status">
            <RelocationBadge data={relocationData} />
          </DetailLabel>
          <DetailLabel title="Owner">
            {relocationData.owner ? (
              <Link aria-label="Owner" to={`/_admin/users/${relocationData.owner.id}/`}>
                {relocationData.owner.email}
              </Link>
            ) : (
              <i>&lt;deleted&gt;</i>
            )}
          </DetailLabel>
          <DetailLabel title="Creator">
            {relocationData.creator ? (
              <Link
                aria-label="Creator"
                to={`/_admin/users/${relocationData.creator.id}/`}
              >
                {relocationData.creator.email}
              </Link>
            ) : (
              <i>&lt;deleted&gt;</i>
            )}
          </DetailLabel>
        </DetailList>
        <DetailList>
          <DetailLabel title="Started">
            {moment(relocationData.dateAdded).fromNow()}
          </DetailLabel>
          <DetailLabel title="Updated">
            {moment(relocationData.dateUpdated).fromNow()}
          </DetailLabel>
          <DetailLabel title="Autopause">
            {relocationData.scheduledPauseAtStep
              ? `${titleCase(relocationData.scheduledPauseAtStep)}`
              : '--'}
          </DetailLabel>
          <DetailLabel title="Owner Notified Of">
            {relocationData.latestNotified
              ? `${titleCase(relocationData.latestNotified)}`
              : '--'}
          </DetailLabel>
          <DetailLabel title="Unclaimed Users Last Notified">
            {relocationData.latestUnclaimedEmailsSentAt
              ? moment(relocationData.latestUnclaimedEmailsSentAt).fromNow()
              : '--'}
          </DetailLabel>
        </DetailList>
      </DetailsContainer>
    );
  };

  const renderSummary = () => {
    const current_step = RelocationSteps[relocationData.step];
    const steps: React.ReactElement[] = [];
    Object.keys(RelocationSteps)
      .filter(step => Number.isNaN(Number(step)))
      .reduce((acc, step, key) => {
        if (acc.length > 0) {
          acc.push();
        }

        let text = <span>{`${key + 1}: ${titleCase(step)}`}</span>;
        if (RelocationSteps[step as keyof typeof RelocationSteps] === current_step) {
          text = <b>{text}</b>;
        }
        if (
          step === relocationData.scheduledPauseAtStep ||
          relocationData.status === 'PAUSE'
        ) {
          text = <i>{text}</i>;
        }

        acc.push(
          <span key={`${step}`}>
            {acc.length > 0 ? <span> | </span> : null}
            {text}
          </span>
        );
        return acc;
      }, steps);

    return (
      <DetailList>
        <DetailLabel title="Progress">{steps}</DetailLabel>
        <DetailLabel title="Requested Slugs">
          {relocationData.wantOrgSlugs.join(', ')}
        </DetailLabel>
        {relocationData.wantUsernames ? (
          <DetailLabel title="Requested Usernames">
            {relocationData.wantUsernames.join(', ')}
          </DetailLabel>
        ) : null}
        {relocationData.failureReason ? (
          <DetailLabel title="Notes">{relocationData.failureReason}</DetailLabel>
        ) : null}
      </DetailList>
    );
  };

  const renderArtifactsSection = () => {
    if (artifactsState === ArtifactsState.DISABLED) {
      return null;
    }
    if (artifactsState === ArtifactsState.ERROR) {
      return {
        noPanel: false,
        content: (
          <div style={{textAlign: 'center'}}>
            Something went wrong while getting the artifacts! Do you have the appropriate
            permissions?
          </div>
        ),
      };
    }

    return {
      noPanel: true,
      content: (
        <ResultGrid
          key="artifacts"
          inPanel
          panelTitle="Relocation Artifacts"
          path={`/_admin/relocations/${relocationData.uuid}/`}
          api={regionApi}
          endpoint={`/relocations/${relocationData.uuid}/artifacts/`}
          method="GET"
          columns={[
            <th key="file" style={{width: 240}}>
              File
            </th>,
            <th key="size" style={{width: 100, textAlign: 'center'}}>
              Size
            </th>,
            <th key="description" style={{textAlign: 'left'}}>
              Description
            </th>,
          ]}
          hasPagination={false}
          columnsForRow={getArtifactRow}
          rowsFromData={response => {
            const receivedArtifacts = new Map(
              response.files
                .map((metadata: any) => {
                  return {
                    regionName,
                    relocation: relocationData,
                    path: metadata.path,
                    description: expectedRelocationArtifacts.get(metadata.path) || '',
                    sizeInKbs: metadata.bytes / 1000,
                  };
                })
                .map((artifact: any) => [artifact.path, artifact])
            );
            return orderedRelocationArtifacts
              .filter(filename => receivedArtifacts.has(filename))
              .map(filename => {
                return receivedArtifacts.get(filename);
              });
          }}
          onLoad={() => {
            setArtifactsState(ArtifactsState.FETCHED);
            addSuccessMessage('Artifacts list loaded.');
          }}
          onError={res => {
            setArtifactsState(ArtifactsState.ERROR);
            if (res.status === 401 || res.status === 403) {
              addErrorMessage(res.responseJSON.detail);
            } else if (res.status === 404) {
              addErrorMessage('Artifacts not found!');
            } else {
              addErrorMessage(
                `Unexpected error condition: ${res.status}(${res.responseText}).`
              );
            }
          }}
        />
      ),
    };
  };

  const renderImportedOrgs = (importedOrgIds: number[]) => {
    return (
      <ResultGrid
        key="orgs"
        inPanel
        panelTitle="Relocated Customers"
        path={`/_admin/relocations/${relocationData.uuid}/`}
        api={regionApi}
        endpoint="/customers/"
        method="GET"
        columns={[
          <th key="customer">Customer</th>,
          <th key="joined" style={{width: 150, textAlign: 'right'}}>
            Joined
          </th>,
        ]}
        columnsForRow={getOrgRow}
        defaultParams={{query: importedOrgIds.map(id => `id:${id.toString()}`).join(' ')}}
      />
    );
  };

  const renderImportedUsers = (importedUserIds: number[]) => {
    return (
      <ResultGrid
        key="users"
        inPanel
        panelTitle="Relocated Users"
        path={`/_admin/relocations/${relocationData.uuid}/`}
        endpoint="/users/"
        method="GET"
        columns={[
          <th key="user">User</th>,
          <th key="email" style={{width: 100, textAlign: 'center'}}>
            Email
          </th>,
          <th key="status" style={{width: 100, textAlign: 'center'}}>
            Status
          </th>,
          <th key="joined" style={{width: 200, textAlign: 'right'}}>
            Joined
          </th>,
        ]}
        columnsForRow={getUserRow}
        defaultParams={{
          query: importedUserIds.map(id => `id:${id.toString()}`).join(' '),
        }}
      />
    );
  };

  const sections = [
    {noPanel: false, content: renderOverview()},
    {noPanel: false, content: renderSummary()},
  ];

  // If we are not sufficiently far along in the relocation step-wise, ignore this bit.
  const stepValue = RelocationSteps[relocationData.step]
    ? Number(RelocationSteps[relocationData.step].valueOf())
    : 0;

  if (stepValue >= 5) {
    if (relocationData.importedOrgIds) {
      sections.push({
        noPanel: true,
        content: renderImportedOrgs(relocationData.importedOrgIds),
      });
    }
    if (relocationData.importedUserIds) {
      sections.push({
        noPanel: true,
        content: renderImportedUsers(relocationData.importedUserIds),
      });
    }
  }

  const maybeArtifactsSection = renderArtifactsSection();
  if (maybeArtifactsSection) {
    sections.push(maybeArtifactsSection);
  }

  return (
    <DetailsPage
      rootName="Relocation"
      name={relocationData.uuid}
      actions={renderActions()}
      sections={sections}
    />
  );
}

export default RelocationDetails;
