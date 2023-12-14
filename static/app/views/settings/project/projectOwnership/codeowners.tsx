import {Component, Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {IconDelete, IconSync} from 'sentry/icons';
import {t} from 'sentry/locale';
import {CodeOwner, CodeownersFile, Organization, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import RulesPanel from 'sentry/views/settings/project/projectOwnership/rulesPanel';

type Props = {
  api: Client;
  codeowners: CodeOwner[];
  disabled: boolean;
  onDelete: (data: CodeOwner) => void;
  onUpdate: (data: CodeOwner) => void;
  organization: Organization;
  project: Project;
};

class CodeOwnersPanel extends Component<Props> {
  handleDelete = async (codeowner: CodeOwner) => {
    const {api, organization, project, onDelete} = this.props;
    const endpoint = `/api/0/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`;
    try {
      await api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      onDelete(codeowner);
      addSuccessMessage(t('Deletion successful'));
    } catch {
      // no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  handleSync = async (codeowner: CodeOwner) => {
    const {api, organization, project, onUpdate} = this.props;
    try {
      const codeownerFile: CodeownersFile = await api.requestPromise(
        `/organizations/${organization.slug}/code-mappings/${codeowner.codeMappingId}/codeowners/`,
        {
          method: 'GET',
        }
      );

      const data = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`,
        {
          method: 'PUT',
          data: {raw: codeownerFile.raw},
        }
      );
      onUpdate({...codeowner, ...data});
      addSuccessMessage(t('CODEOWNERS file sync successful.'));
    } catch (_err) {
      addErrorMessage(t('An error occurred trying to sync CODEOWNERS file.'));
    }
  };
  render() {
    const {codeowners, disabled} = this.props;
    return codeowners.map(codeowner => {
      const {dateUpdated, provider, codeMapping, ownershipSyntax} = codeowner;
      return (
        <Fragment key={codeowner.id}>
          <RulesPanel
            data-test-id="codeowners-panel"
            type="codeowners"
            raw={ownershipSyntax || ''}
            dateUpdated={dateUpdated}
            provider={provider}
            repoName={codeMapping?.repoName}
            controls={[
              <Button
                key="sync"
                icon={<IconSync />}
                size="xs"
                onClick={() => this.handleSync(codeowner)}
                disabled={disabled}
                aria-label={t('Sync')}
              />,
              <Confirm
                onConfirm={() => this.handleDelete(codeowner)}
                message={t('Are you sure you want to remove this CODEOWNERS file?')}
                key="confirm-delete"
                disabled={disabled}
              >
                <Button
                  key="delete"
                  icon={<IconDelete />}
                  aria-label={t('Delete')}
                  size="xs"
                />
              </Confirm>,
            ]}
          />
        </Fragment>
      );
    });
  }
}

export default withApi(CodeOwnersPanel);
