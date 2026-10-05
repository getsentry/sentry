import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Project} from 'sentry/types/project';
import {ConnectRepositoryForm} from 'sentry/views/settings/projectGeneralSettings/connectRepositoryForm';
import {EditRepositoryForm} from 'sentry/views/settings/projectGeneralSettings/editRepositoryForm';

type ConnectRepositoryModalProps = ModalRenderProps & {
  project: Project;
} & (
    | {mode: 'connect'}
    | {
        externalId: string | null;
        integrationId: string | null;
        mode: 'edit';
        providerKey: string | null;
        repoName: string;
        repositoryId: string;
      }
  );

export function ConnectRepositoryModal(props: ConnectRepositoryModalProps) {
  if (props.mode === 'edit') {
    return <EditRepositoryForm {...props} />;
  }
  return <ConnectRepositoryForm {...props} />;
}
