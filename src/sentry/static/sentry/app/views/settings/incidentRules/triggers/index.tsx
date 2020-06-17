import React from 'react';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import CircleIndicator from 'app/components/circleIndicator';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';

import {MetricActionTemplate, Trigger} from '../types';

type DeleteButtonProps = {
  triggerIndex: number;
  disabled: boolean;
  onDelete: (triggerIndex: number, e: React.MouseEvent<Element>) => void;
};

/**
 * Button to delete a trigger
 */
const DeleteButton = ({triggerIndex, onDelete, disabled}: DeleteButtonProps) => (
  <Button
    type="button"
    icon={<IconDelete size="xs" />}
    size="xsmall"
    aria-label={t('Delete Trigger')}
    onClick={(e: React.MouseEvent<Element>) => onDelete(triggerIndex, e)}
    disabled={disabled}
  >
    {t('Delete')}
  </Button>
);

type Props = {
  organization: Organization;
  projects: Project[];
  ruleId?: string;
  triggers: Trigger[];
  currentProject: string;
  availableActions: MetricActionTemplate[] | null;
  disabled: boolean;

  errors: Map<number, {[fieldName: string]: string}>;

  onAdd: () => void;
  onChange: (
    triggers: Trigger[],
    triggerIndex?: number,
    changeObj?: Partial<Trigger>
  ) => void;
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

  handleChangeTrigger = (
    triggerIndex: number,
    trigger: Trigger,
    changeObj: Partial<Trigger>
  ) => {
    const {triggers, onChange} = this.props;
    let updatedTriggers = replaceAtArrayIndex(triggers, triggerIndex, trigger);

    // If we have multiple triggers (warning and critical), we need to make sure
    // the triggers have the same threshold direction
    if (triggers.length > 1) {
      const otherIndex = triggerIndex ^ 1;
      let otherTrigger = triggers[otherIndex];
      if (trigger.thresholdType !== otherTrigger.thresholdType) {
        otherTrigger = {
          ...otherTrigger,
          thresholdType: trigger.thresholdType,
        };
      }

      updatedTriggers = replaceAtArrayIndex(updatedTriggers, otherIndex, otherTrigger);
    }

    onChange(updatedTriggers, triggerIndex, changeObj);
  };

  render() {
    const {
      availableActions,
      currentProject,
      errors,
      organization,
      projects,
      triggers,
      disabled,
      onAdd,
    } = this.props;

    // Note we only support 2 triggers max
    return (
      <React.Fragment>
        {triggers.map((trigger, index) => {
          const isCritical = index === 0;
          const title = isCritical ? t('Critical Trigger') : t('Warning Trigger');
          return (
            <Panel key={index}>
              <PanelHeader hasButtons={!isCritical}>
                <Title>
                  {isCritical ? <CriticalIndicator /> : <WarningIndicator />}
                  {title}
                </Title>
                {!isCritical && (
                  <DeleteButton
                    disabled={disabled}
                    triggerIndex={index}
                    onDelete={this.handleDeleteTrigger}
                  />
                )}
              </PanelHeader>
              <PanelBody>
                <TriggerForm
                  disabled={disabled}
                  isCritical={isCritical}
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

        {triggers.length < 2 && (
          <AddWarningButton
            disabled={disabled}
            type="button"
            size="small"
            icon={<WarningIndicator size={12} />}
            onClick={onAdd}
          >
            {t('Add Warning Trigger')}
          </AddWarningButton>
        )}
      </React.Fragment>
    );
  }
}

const AddWarningButton = styled(Button)`
  margin-bottom: ${space(3)};
`;

const Title = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
`;

const CriticalIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.redLight};
`;

const WarningIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.yellow500};
`;

export default withProjects(Triggers);
