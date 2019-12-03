import React from 'react';
import styled from 'react-emotion';

import {Trigger} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {t} from 'app/locale';
import Button from 'app/components/button';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import withProjects from 'app/utils/withProjects';
import {MetricAction} from 'app/types/alerts';

type DeleteButtonProps = {
  triggerIndex: number;
  onDelete: (triggerIndex: number, e: React.MouseEvent<Element>) => void;
};

/**
 * Button to delete a trigger
 */
const DeleteButton: React.FC<DeleteButtonProps> = ({
  triggerIndex,
  onDelete,
}: DeleteButtonProps) => (
  <Button
    type="button"
    icon="icon-trash"
    size="xsmall"
    aria-label={t('Delete Trigger')}
    onClick={(e: React.MouseEvent<Element>) => onDelete(triggerIndex, e)}
  >
    {t('Delete')}
  </Button>
);

type Props = {
  organization: Organization;
  projects: Project[];
  incidentRuleId?: string;
  triggers: Trigger[];
  currentProject: string;
  availableActions: MetricAction[] | null;

  errors: Map<number, {[fieldName: string]: string}>;

  onAdd: () => void;
  onChange: (triggers: Trigger[]) => void;
};

/**
 * A list of forms to add, edit, and delete triggers.
 */
class Triggers extends React.Component<Props> {
  handleDeleteTrigger = (index: number) => {
    const {triggers, onChange} = this.props;
    const updatedTriggers = removeAtArrayIndex(triggers, index);

    onChange(updatedTriggers);
  };

  handleChangeTrigger = (triggerIndex: number, trigger: Trigger) => {
    const {triggers, onChange} = this.props;
    const updatedTriggers = replaceAtArrayIndex(triggers, triggerIndex, trigger);

    onChange(updatedTriggers);
  };

  render() {
    const {
      availableActions,
      currentProject,
      errors,
      organization,
      projects,
      triggers,
      onAdd,
    } = this.props;

    return (
      <React.Fragment>
        {triggers.map((trigger, index) => {
          return (
            <Panel key={index}>
              <PanelHeader hasButtons>
                {t('Define Trigger')}
                <DeleteButton triggerIndex={index} onDelete={this.handleDeleteTrigger} />
              </PanelHeader>
              <PanelBody>
                <TriggerForm
                  error={errors && errors.get(index)}
                  availableActions={availableActions}
                  organization={organization}
                  projects={projects}
                  currentProject={currentProject}
                  trigger={trigger}
                  triggerIndex={index}
                  onChange={this.handleChangeTrigger}
                />
              </PanelBody>
            </Panel>
          );
        })}

        <BorderlessPanel>
          <FullWidthButton
            type="button"
            size="small"
            icon="icon-circle-add"
            onClick={onAdd}
          >
            {t('Add another Trigger')}
          </FullWidthButton>
        </BorderlessPanel>
      </React.Fragment>
    );
  }
}

const BorderlessPanel = styled(Panel)`
  border: none;
`;

const FullWidthButton = styled(Button)`
  width: 100%;
`;

export default withProjects(Triggers);
