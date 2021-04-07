import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons';
import {t} from 'app/locale';
import {CodeOwners, Organization, Project} from 'app/types';
import RulesPanel from 'app/views/settings/project/projectOwnership/rulesPanel';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  project: Project;
};

type State = {} & AsyncComponent['state'];

class CodeOwnersPanel extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project} = this.props;
    return [
      [
        'codeowners',
        `/projects/${organization.slug}/${project.slug}/codeowners/?expand=codeMapping`,
      ],
    ];
  }

  handleDelete = async (codeowner: CodeOwners) => {
    const {organization, project} = this.props;
    const endpoint = `/api/0/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`;
    try {
      await this.api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      // remove config and update state
      const {codeowners} = this.state;
      this.setState({
        codeowners: codeowners.filter(config => config.id !== codeowner.id),
      });
      addSuccessMessage(t('Deletion successful'));
    } catch {
      //no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  renderBody() {
    const {codeowners} = this.state;
    return codeowners.map(codeowner => {
      const {
        raw,
        dateUpdated,
        provider,
        codeMapping: {repoName},
      } = codeowner;
      return (
        <React.Fragment key={codeowner.id}>
          <RulesPanel
            type="codeowners"
            raw={raw}
            dateUpdated={dateUpdated}
            provider={provider}
            repoName={repoName}
            readOnly
            controls={[
              <Confirm
                onConfirm={() => this.handleDelete(codeowner)}
                message={t('Are you sure you want to remove this CodeOwners?')}
                key="confirm-delete"
              >
                <Button key="delete" icon={<IconDelete size="xs" />} size="xsmall" />
              </Confirm>,
            ]}
          />
        </React.Fragment>
      );
    });
  }
}

export default CodeOwnersPanel;
