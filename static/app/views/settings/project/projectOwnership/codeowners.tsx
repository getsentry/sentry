import {Component, Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons';
import {t} from 'app/locale';
import {CodeOwners, Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import RulesPanel from 'app/views/settings/project/projectOwnership/rulesPanel';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  codeowners: any;
  onDelete: (data: any) => void;
};

class CodeOwnersPanel extends Component<Props> {
  handleDelete = async (codeowner: CodeOwners) => {
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

  render() {
    const {codeowners} = this.props;
    return (codeowners || []).map(codeowner => {
      const {
        dateUpdated,
        provider,
        codeMapping: {repoName},
        ownershipSyntax,
      } = codeowner;
      return (
        <Fragment key={codeowner.id}>
          <RulesPanel
            data-test-id="codeowners-panel"
            type="codeowners"
            raw={ownershipSyntax}
            dateUpdated={dateUpdated}
            provider={provider}
            repoName={repoName}
            readOnly
            controls={[
              <Confirm
                onConfirm={() => this.handleDelete(codeowner)}
                message={t('Are you sure you want to remove this CODEOWNERS file?')}
                key="confirm-delete"
              >
                <Button key="delete" icon={<IconDelete size="xs" />} size="xsmall" />
              </Confirm>,
            ]}
          />
        </Fragment>
      );
    });
  }
}

export default withApi(CodeOwnersPanel);
