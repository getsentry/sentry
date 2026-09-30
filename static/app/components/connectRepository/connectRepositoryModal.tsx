import {
  ConnectRepositoryForm,
  type ConnectFormProps,
} from 'sentry/components/connectRepository/connectRepositoryForm';
import {
  EditRepositoryForm,
  type EditFormProps,
} from 'sentry/components/connectRepository/editRepositoryForm';
import {
  RepoLockedConnectForm,
  type RepoLockedConnectFormProps,
} from 'sentry/components/connectRepository/repoLockedConnectForm';

export type ConnectRepositoryModalProps =
  | (EditFormProps & {mode: 'edit'})
  | (RepoLockedConnectFormProps & {mode: 'connect'; lockedSide: 'repo'})
  | (ConnectFormProps & {mode: 'connect'; lockedSide?: 'project'});

export function ConnectRepositoryModal(props: ConnectRepositoryModalProps) {
  if (props.mode === 'edit') {
    return <EditRepositoryForm {...props} />;
  }
  if (props.lockedSide === 'repo') {
    return <RepoLockedConnectForm {...props} />;
  }
  return <ConnectRepositoryForm {...props} />;
}
