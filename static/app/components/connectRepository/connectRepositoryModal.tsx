import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ConnectRepositoryForm} from 'sentry/components/connectRepository/connectRepositoryForm';
import {EditRepositoryForm} from 'sentry/components/connectRepository/editRepositoryForm';
import type {Project} from 'sentry/types/project';

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
