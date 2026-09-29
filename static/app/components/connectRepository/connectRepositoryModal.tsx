import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Project} from 'sentry/types/project';
import {ConnectRepositoryForm} from 'sentry/components/connectRepository/connectRepositoryForm';
import {EditRepositoryForm} from 'sentry/components/connectRepository/editRepositoryForm';

type ConnectRepositoryModalProps = ModalRenderProps & {
  project: Project;
} & (
    | {mode: 'connect'}
    | {
        mode: 'edit';
        externalId: string | null;
        integrationId: string | null;
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
