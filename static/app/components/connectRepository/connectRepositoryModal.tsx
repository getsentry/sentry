import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Project} from 'sentry/types/project';
import {ConnectRepositoryForm} from 'sentry/components/connectRepository/connectRepositoryForm';
import {EditRepositoryForm} from 'sentry/components/connectRepository/editRepositoryForm';
import {RepoLockedConnectForm} from 'sentry/components/connectRepository/repoLockedConnectForm';

type RepoIdentity = {
  externalId: string | null;
  integrationId: string | null;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
};

// Project-locked: the project is fixed; the user picks the repository.
type ProjectLockedConnect = {lockedSide?: 'project'; mode: 'connect'; project: Project};
type ProjectLockedEdit = {
  lockedSide?: 'project';
  mode: 'edit';
  project: Pick<Project, 'id' | 'slug'>;
} & RepoIdentity;

// Repo-locked: the repository is fixed; the user picks the project (connect)
// or both fields are locked (edit, project resolved by the caller).
type RepoLockedConnect = {lockedSide: 'repo'; mode: 'connect'} & RepoIdentity;
type RepoLockedEdit = {
  lockedSide: 'repo';
  mode: 'edit';
  project: Pick<Project, 'id' | 'slug'>;
} & RepoIdentity;

export type ConnectRepositoryModalProps = ModalRenderProps &
  (ProjectLockedConnect | ProjectLockedEdit | RepoLockedConnect | RepoLockedEdit);

export function ConnectRepositoryModal(props: ConnectRepositoryModalProps) {
  if (props.mode === 'edit') {
    return <EditRepositoryForm {...props} />;
  }
  if (props.lockedSide === 'repo') {
    return <RepoLockedConnectForm {...props} />;
  }
  return <ConnectRepositoryForm {...props} />;
}
