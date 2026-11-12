import {ConnectRepositoryForm, type ConnectFormProps} from './connectRepositoryForm';
import {EditRepositoryForm, type EditFormProps} from './editRepositoryForm';
import {
  RepoLockedConnectForm,
  type RepoLockedConnectFormProps,
} from './repoLockedConnectForm';

export type ConnectRepositoryModalProps =
  | (EditFormProps & {mode: 'edit'})
  | (RepoLockedConnectFormProps & {lockedSide: 'repo'; mode: 'connect'})
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
