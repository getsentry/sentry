import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import {Organization, Project} from 'app/types';
import RulesPanel from 'app/views/settings/project/projectOwnership/rulesPanel';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  project: Project;
};

type State = {} & AsyncComponent['state'];

class CodeOwners extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project} = this.props;
    return [
      [
        'codeowners',
        `/projects/${organization.slug}/${project.slug}/codeowners/?expand=codeMapping`,
      ],
    ];
  }

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
              <Button key="delete" icon={<IconDelete size="xs" />} size="xsmall" />,
            ]}
          />
        </React.Fragment>
      );
    });
  }
}

export default CodeOwners;
