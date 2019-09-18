import React from 'react';
import styled from 'react-emotion';

import {IncidentRule} from 'app/views/settings/incidentRules/constants';
import {Organization, Project} from 'app/types';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import space from 'app/styles/space';

type Props = {
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
};

class TriggersModal extends React.Component<Props> {
  handleSubmitSuccess = () => {
    addSuccessMessage(t('Successfully saved Incident Rule'));
  };

  render() {
    const {organization, projects, rule} = this.props;
    return (
      <div>
        <TinyHeader>{t('Trigger for')}</TinyHeader>
        <RuleName>{rule.name}</RuleName>
        <TriggerForm
          organization={organization}
          projects={projects || []}
          orgId={organization.slug}
          onSubmitSuccess={this.handleSubmitSuccess}
          rule={rule}
        />
      </div>
    );
  }
}

export default TriggersModal;

const TinyHeader = styled('h6')`
  color: ${p => p.theme.gray2};
  text-transform: uppercase;
  margin-bottom: ${space(1)};

  &::after {
    content: ':';
  }
`;

const RuleName = styled('h3')`
  font-weight: normal;
`;
