import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Goal} from 'app/types';
import space from 'app/styles/space';
import {ModalRenderProps} from 'app/actionCreators/modal';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelItem} from 'app/components/panels';
import Button from 'app/components/button';
import TextField from 'app/views/settings/components/forms/textField';
import SelectControl from 'app/components/forms/selectControl';
import {BufferedInput} from 'app/views/eventsV2/table/queryField';

import {aggregateOptions, comparisonOperatorsOptions} from './mocks';

type Props = {
  onSave: (goal: Partial<Goal>) => void;
} & ModalRenderProps;

type State = {
  goal: Partial<Omit<Goal, 'id'>>;
};

class ModalAddGoal extends React.Component<Props, State> {
  state: State = {
    goal: {
      title: '',
      transactionName: '',
      refinement: '0.99',
    },
  };

  handleSave = () => {
    const {onSave, closeModal} = this.props;
    onSave(this.state.goal);
    closeModal();
  };

  handleChange = (field: keyof State['goal']) => (value: string) => {
    this.setState(prevState => ({
      goal: {
        ...prevState.goal,
        [field]: value,
      },
    }));
  };

  render() {
    const {Header, Body, Footer, closeModal} = this.props;
    const {goal} = this.state;

    return (
      <React.Fragment>
        <Header closeButton>{t('Add Goal')}</Header>
        <Body>
          <Panel>
            <TextField
              name="goal-name"
              label={t('Title')}
              onChange={value => {
                this.handleChange('title')(value);
              }}
              value={goal.title}
            />
            <TextField
              name="transaction-name"
              label={t('Transaction')}
              onChange={value => {
                this.handleChange('transactionName')(value);
              }}
              value={goal.transactionName}
            />
            <PanelItem>
              <ObjectiveContainer>
                <AggregateContainer>
                  <SelectControl
                    key="select"
                    name="aggregateObjective"
                    placeholder={t('Select aggregate')}
                    options={aggregateOptions}
                    value={aggregateOptions[1]}
                    onChange={this.handleChange('aggregateObjective')}
                    required
                  />
                </AggregateContainer>
                <ComparisonOperatorContainer>
                  <SelectControl
                    key="select"
                    name="comparison-operator"
                    placeholder={t('Comparison operator')}
                    options={comparisonOperatorsOptions}
                    value={comparisonOperatorsOptions[0]}
                    onChange={this.handleChange('comparisonOperator')}
                    required
                  />
                </ComparisonOperatorContainer>
                <ObjectiveValueContainer>
                  <BufferedInput
                    name="refinement"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*(\.[0-9]*)?"
                    value={goal.refinement!}
                    required
                    onUpdate={value => {
                      this.handleChange('refinement')(value);
                    }}
                  />
                </ObjectiveValueContainer>
              </ObjectiveContainer>
            </PanelItem>
          </Panel>
        </Body>
        <Footer>
          <ButtonBar gap={1.5}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button onClick={this.handleSave} priority="primary">
              {t('Save Goal')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default ModalAddGoal;

const ObjectiveContainer = styled('div')`
  width: 100%;
  display: flex;

  > * + * {
    margin-left: ${space(1)};
  }
`;

const AggregateContainer = styled('div')`
  flex-grow: 1;
`;

const ComparisonOperatorContainer = styled('div')`
  min-width: 100px;
`;

const ObjectiveValueContainer = styled('div')`
  min-width: 150px;
`;
