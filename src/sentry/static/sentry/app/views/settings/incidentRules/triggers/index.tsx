import React from 'react';
import styled from 'react-emotion';

import {MetricAction} from 'app/types/alerts';
import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {Trigger} from 'app/views/settings/incidentRules/types';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {t} from 'app/locale';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';

type DeleteButtonProps = {
  triggerIndex: number;
  disabled: boolean;
  onDelete: (triggerIndex: number, e: React.MouseEvent<Element>) => void;
};

/**
 * Button to delete a trigger
 */
const DeleteButton: React.FC<DeleteButtonProps> = ({
  triggerIndex,
  onDelete,
  disabled,
}: DeleteButtonProps) => (
  <Button
    type="button"
    icon="icon-trash"
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
  incidentRuleId?: string;
  triggers: Trigger[];
  currentProject: string;
  availableActions: MetricAction[] | null;
  disabled: boolean;

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
      disabled,
      onAdd,
    } = this.props;

    // Note we only support 2 triggers on UI - API can support many
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
          <BorderlessPanel>
            <FullWidthButton
              type="button"
              size="small"
              icon="icon-circle-add"
              onClick={onAdd}
            >
              {t('Add Warning Trigger')}
            </FullWidthButton>
          </BorderlessPanel>
        )}
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
  background: ${p => p.theme.yellowDark};
`;

export default withProjects(Triggers);
