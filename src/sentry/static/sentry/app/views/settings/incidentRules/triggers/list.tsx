import React from 'react';
import styled, {css} from 'react-emotion';

import {Panel, PanelBody, PanelItem, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import space from 'app/styles/space';

import {Trigger} from '../types';
import getTriggerConditionDisplayName from '../utils/getTriggerConditionDisplayName';

type Props = {
  triggers: Trigger[];
  onDelete: (trigger: Trigger) => void;
  onEdit: (trigger: Trigger) => void;
};

export default class TriggersList extends React.Component<Props> {
  handleEdit = (trigger: Trigger) => {
    this.props.onEdit(trigger);
  };

  handleDelete = (trigger: Trigger) => {
    this.props.onDelete(trigger);
  };

  render() {
    const {triggers} = this.props;

    const isEmpty = triggers && !triggers.length;

    return (
      <Panel>
        <PanelHeaderGrid>
          <div>{t('Label')}</div>
          <div>{t('Condition')}</div>
          <div>{t('Actions')}</div>
        </PanelHeaderGrid>
        <PanelBody>
          {isEmpty && <EmptyMessage>{t('No triggers added')}</EmptyMessage>}
          {triggers.map((trigger, index) => {
            const [mainCondition, secondaryCondition] = getTriggerConditionDisplayName(
              trigger
            );

            return (
              <Grid key={trigger.id || `new-${index}`}>
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
                        priority="default"
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
