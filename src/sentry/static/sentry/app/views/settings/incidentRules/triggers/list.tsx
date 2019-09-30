import React from 'react';
import styled, {css} from 'react-emotion';

import {Panel, PanelBody, PanelItem, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import space from 'app/styles/space';

import {Trigger, AlertRuleThresholdType} from '../types';

type Props = {
  triggers: Trigger[];
  onDelete: (trigger: Trigger) => void;
  onEdit: (trigger: Trigger) => void;
};

function getConditionStrings(trigger: Trigger): [string, string | null] {
  if (trigger.thresholdType === AlertRuleThresholdType.ABOVE) {
    return [
      `> ${trigger.alertThreshold}`,
      typeof trigger.resolveThreshold !== 'undefined' && trigger.resolveThreshold !== null
        ? `Auto-resolves when metric falls below ${trigger.resolveThreshold}`
        : null,
    ];
  } else {
    return [
      `< ${trigger.alertThreshold}`,
      typeof trigger.resolveThreshold !== 'undefined' && trigger.resolveThreshold !== null
        ? `Auto-resolves when metric is above ${trigger.resolveThreshold}`
        : null,
    ];
  }
}
export default class TriggersList extends React.Component<Props> {
  handleEdit = (trigger: Trigger) => {
    this.props.onEdit(trigger);
  };

  handleDelete = (trigger: Trigger) => {
    this.props.onDelete(trigger);
  };

  render() {
    const {triggers} = this.props;

    return (
      <Panel>
        <PanelHeaderGrid>
          <div>{t('Label')}</div>
          <div>{t('Condition')}</div>
          <div>{t('Actions')}</div>
        </PanelHeaderGrid>
        <PanelBody>
          {triggers.map(trigger => {
            const [mainCondition, secondaryCondition] = getConditionStrings(trigger);

            return (
              <Grid key={trigger.id}>
                <Label>{trigger.label}</Label>
                <Condition>
                  <MainCondition>{mainCondition}</MainCondition>
                  {secondaryCondition !== null && (
                    <SecondaryCondition>{secondaryCondition}</SecondaryCondition>
                  )}
                </Condition>
                <Actions>
                  N/A
                  <ButtonBar>
                    <Button
                      type="button"
                      priority="default"
                      icon="icon-edit"
                      size="small"
                      onClick={() => this.handleEdit(trigger)}
                    >
                      {t('Edit')}
                    </Button>
                    <Confirm
                      onConfirm={() => this.handleDelete(trigger)}
                      message={t('Are you sure you want to delete this trigger?')}
                      priority="danger"
                    >
                      <Button
                        priority="danger"
                        size="small"
                        aria-label={t('Delete Trigger')}
                        icon="icon-trash"
                      />
                    </Confirm>
                  </ButtonBar>
                </Actions>
              </Grid>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

const gridCss = css`
  display: grid;
  grid-template-columns: 1fr 2fr 3fr;
  grid-gap: ${space(1)};
  align-items: center;
`;

const PanelHeaderGrid = styled(PanelHeader)`
  ${gridCss};
`;

const Grid = styled(PanelItem)`
  ${gridCss};
`;

const Label = styled('div')`
  font-size: 1.2em;
`;

const Condition = styled('div')``;

const MainCondition = styled('div')``;
const SecondaryCondition = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray2};
`;

const Actions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ButtonBar = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
`;
