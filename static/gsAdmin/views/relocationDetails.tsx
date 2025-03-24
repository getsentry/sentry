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
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import ConfigStore from 'sentry/stores/configStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';

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

type Props = DeprecatedAsyncComponent['props'] &
  RouteComponentProps<{regionName: string; relocationUuid: string}, unknown> & {
    api: Client;
  };

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

type State = DeprecatedAsyncComponent['state'] & {
  artifactsState: ArtifactsState;
  data: Relocation;
};

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

class RelocationDetails extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const region = ConfigStore.get('regions').find(
      (r: any) => r.name === this.props.params.regionName
    );
    return [
      [
        'data',
        `/relocations/${this.props.params.relocationUuid}/`,
        {
          host: region ? region.url : '',
        },
      ],
    ];
  }

  componentDidMount() {
    super.componentDidMount();

    const region = ConfigStore.get('regions').find(
      (r: any) => r.name === this.props.params.regionName
    );
    this.setState({
      artifactsState: ArtifactsState.DISABLED,
      region,
    });
    this.api = new Client({
      baseUrl: `${region?.url || ''}/api/0`,
    });
  }

  onDataUpdate = (data: any) => {
    this.setState({
      data: {
        ...data,
        region: ConfigStore.get('regions').find(
          (region: any) => region.name === this.props.params.regionName
        ),
      },
    });
  };

  onRequestSuccess = ({stateKey, data}: any) => {
    if (stateKey === 'data') {
      this.onDataUpdate(data);
    }
  };

  renderActions() {
    const data: Relocation = this.state.data;
    const artifactsState: ArtifactsState = this.state.artifactsState;
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
          if (this.state.artifactsState !== ArtifactsState.FETCHING) {
            clearIndicators();
            addLoadingMessage('Loading artifacts list...');
            this.setState({
              artifactsState: ArtifactsState.FETCHING,
            });
          }
        },
      });
    }

    // There are no actions for a relocation that has already succeeded.
    if (data.status === 'SUCCESS') {
      return actions;
    }

    // Only one possible action for a failed relocation.
    if (data.status === 'FAILURE') {
      actions.push({
        key: 'retry',
        name: 'Retry',
        help: 'Retry this relocation.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationRetryModal
              {...deps}
              relocation={data}
              onSuccess={(rawRelocation: Relocation) => {
                browserHistory.push(
                  `/_admin/relocations/${data.region.name}/${rawRelocation.uuid}/`
                );
              }}
            />
          ));
        },
      });
      return actions;
    }

    // In progress relocations may be paused, unless we are on the penultimate step.
    if (data.status === 'IN_PROGRESS' && data.step !== 'NOTIFYING') {
      actions.push({
        key: 'pause',
        name: 'Schedule Pause',
        help: 'Specify the step prior to which this relocation will be autopaused.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationPauseModal
              {...deps}
              relocation={data}
              onSuccess={(rawRelocation: Relocation) => {
                this.onDataUpdate(rawRelocation);
              }}
            />
          ));
        },
      });
    }

    // A paused relocation, or one that already has a pause scheduled, can be unpaused.
    const hasScheduledPause =
      data.status === 'IN_PROGRESS' && data.scheduledPauseAtStep !== null;
    if (data.status === 'PAUSE' || hasScheduledPause) {
      actions.push({
        key: 'unpause',
        name: 'Unpause',
        help: 'Disable an active or scheduled autopause.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationUnpauseModal
              {...deps}
              relocation={data}
              onSuccess={(rawRelocation: Relocation) => {
                this.onDataUpdate(rawRelocation);
              }}
            />
          ));
        },
      });
    }

    // Relocations may be cancelled, unless we are on the penultimate step.
    if (data.step !== 'NOTIFYING') {
      actions.push({
        key: 'cancel',
        name: 'Schedule Cancellation',
        help: 'Schedule the orderly cancellation of an in-progress relocation.',
        skipConfirmModal: true,
        onAction: () => {
          openModal(deps => (
            <RelocationCancelModal
              {...deps}
              relocation={data}
              onSuccess={(rawRelocation: Relocation) => {
                this.onDataUpdate(rawRelocation);
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
            relocation={data}
            onSuccess={(rawRelocation: Relocation) => {
              this.onDataUpdate(rawRelocation);
            }}
          />
        ));
      },
    });

    return actions;
  }

  renderOverview() {
    const data: Relocation = this.state.data;
    return (
      <DetailsContainer>
        <DetailList>
          <DetailLabel title="Provenance">
            <code>{data.provenance}</code>
          </DetailLabel>
          <DetailLabel title="Region">
            <code>{this.props.params.regionName}</code>
          </DetailLabel>
          <DetailLabel title="Status">
            <RelocationBadge data={data} />
          </DetailLabel>
          <DetailLabel title="Owner">
            {data.owner ? (
              <Link aria-label="Owner" to={`/_admin/users/${data.owner.id}/`}>
                {data.owner.email}
              </Link>
            ) : (
              <i>&lt;deleted&gt;</i>
            )}
          </DetailLabel>
          <DetailLabel title="Creator">
            {data.creator ? (
              <Link aria-label="Creator" to={`/_admin/users/${data.creator.id}/`}>
                {data.creator.email}
              </Link>
            ) : (
              <i>&lt;deleted&gt;</i>
            )}
          </DetailLabel>
        </DetailList>
        <DetailList>
          <DetailLabel title="Started">{moment(data.dateAdded).fromNow()}</DetailLabel>
          <DetailLabel title="Updated">{moment(data.dateUpdated).fromNow()}</DetailLabel>
          <DetailLabel title="Autopause">
            {data.scheduledPauseAtStep ? `${titleCase(data.scheduledPauseAtStep)}` : '--'}
          </DetailLabel>
          <DetailLabel title="Owner Notified Of">
            {data.latestNotified ? `${titleCase(data.latestNotified)}` : '--'}
          </DetailLabel>
          <DetailLabel title="Unclaimed Users Last Notified">
            {data.latestUnclaimedEmailsSentAt
              ? moment(data.latestUnclaimedEmailsSentAt).fromNow()
              : '--'}
          </DetailLabel>
        </DetailList>
      </DetailsContainer>
    );
  }

  renderSummary() {
    const data: Relocation = this.state.data;
    const current_step = RelocationSteps[data.step];
    const steps: React.ReactElement[] = [];
    Object.keys(RelocationSteps)
      .filter(step => Number.isNaN(Number(step)))
      .reduce((acc, step, key) => {
        if (acc.length > 0) {
          acc.push();
        }

        let text = <span>{`${key + 1}: ${titleCase(step)}`}</span>;
        // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
        if (RelocationSteps[step] === current_step) {
          text = <b>{text}</b>;
        }
        if (step === data.scheduledPauseAtStep || data.status === 'PAUSE') {
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
        <DetailLabel title="Requested Slugs">{data.wantOrgSlugs.join(', ')}</DetailLabel>
        {data.wantUsernames ? (
          <DetailLabel title="Requested Usernames">
            {data.wantUsernames.join(', ')}
          </DetailLabel>
        ) : null}
        {data.failureReason ? (
          <DetailLabel title="Notes">{data.failureReason}</DetailLabel>
        ) : null}
      </DetailList>
    );
  }

  renderArtifactsSection() {
    if (this.state.artifactsState === ArtifactsState.DISABLED) {
      return null;
    }
    if (this.state.artifactsState === ArtifactsState.ERROR) {
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
          path={`/_admin/relocations/${this.state.data.uuid}/`}
          api={this.api}
          endpoint={`/relocations/${this.state.data.uuid}/artifacts/`}
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
                    regionName: this.props.params.regionName,
                    relocation: this.state.data,
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
            this.setState({artifactsState: ArtifactsState.FETCHED});
            addSuccessMessage('Artifacts list loaded.');
          }}
          onError={res => {
            this.setState({artifactsState: ArtifactsState.ERROR});
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
  }

  renderImportedOrgs(importedOrgIds: number[]) {
    return (
      <ResultGrid
        key="orgs"
        inPanel
        panelTitle="Relocated Customers"
        path={`/_admin/relocations/${this.state.data.uuid}/`}
        api={this.api}
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
  }

  renderImportedUsers(importedUserIds: number[]) {
    return (
      <ResultGrid
        key="users"
        inPanel
        panelTitle="Relocated Users"
        path={`/_admin/relocations/${this.state.data.uuid}/`}
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
  }

  renderBody() {
    const data: Relocation = this.state.data;
    const sections = [
      {noPanel: false, content: this.renderOverview()},
      {noPanel: false, content: this.renderSummary()},
    ];

    // If we are not sufficiently far along in the relocation step-wise, ignore this bit.
    if (RelocationSteps[data.step].valueOf() >= 5) {
      if (data.importedOrgIds) {
        sections.push({
          noPanel: true,
          content: this.renderImportedOrgs(data.importedOrgIds),
        });
      }
      if (data.importedUserIds) {
        sections.push({
          noPanel: true,
          content: this.renderImportedUsers(data.importedUserIds),
        });
      }
    }

    const maybeArtifactsSection = this.renderArtifactsSection();
    if (maybeArtifactsSection) {
      sections.push(maybeArtifactsSection);
    }

    return (
      <DetailsPage
        rootName="Relocation"
        name={data.uuid}
        actions={this.renderActions()}
        sections={sections}
      />
    );
  }
}

export default RelocationDetails;
