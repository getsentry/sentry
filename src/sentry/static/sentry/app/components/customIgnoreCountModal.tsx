import React from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {Choices, ResolutionStatusDetails} from 'app/types';
import InputField from 'app/views/settings/components/forms/inputField';
import SelectField from 'app/views/settings/components/forms/selectField';

type CountNames = 'ignoreCount' | 'ignoreUserCount';
type WindowNames = 'ignoreWindow' | 'ignoreUserWindow';

type Props = ModalRenderProps & {
  onSelected: (statusDetails: ResolutionStatusDetails) => void;
  label: string;
  countLabel: string;
  countName: CountNames;
  windowName: WindowNames;
  windowChoices: Choices;
};

type State = {
  count: number;
  window: number | null;
};

class CustomIgnoreCountModal extends React.Component<Props, State> {
  state: State = {
    count: 100,
    window: null,
  };

  handleSubmit = () => {
    const {count, window} = this.state;
    const {countName, windowName} = this.props;

    const statusDetails: ResolutionStatusDetails = {[countName]: count};
    if (window) {
      statusDetails[windowName] = window;
    }
    this.props.onSelected(statusDetails);
    this.props.closeModal();
  };

  handleChange = (name: keyof State, value: number) => {
    this.setState({[name]: value} as State);
  };

  render() {
    const {
      Header,
      Footer,
      Body,
      countLabel,
      label,
      closeModal,
      windowChoices,
    } = this.props;
    const {count, window} = this.state;
    return (
      <React.Fragment>
        <Header>
          <h4>{label}</h4>
        </Header>
        <Body>
          <InputField
            inline={false}
            flexibleControlStateSize
            stacked
            label={countLabel}
            name="count"
            type="number"
            value={count}
            onChange={val => this.handleChange('count' as 'count', Number(val))}
            required
            placeholder={t('e.g. 100')}
          />
          <SelectField
            inline={false}
            flexibleControlStateSize
            stacked
            label={t('Time window')}
            value={window}
            name="window"
            onChange={val => this.handleChange('window' as const, val)}
            choices={windowChoices}
            placeholder={t('e.g. per hour')}
            allowClear
            help={t('(Optional) If supplied, this rule will apply as a rate of change.')}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button type="button" onClick={closeModal}>
              {t('Cancel')}
            </Button>
            <Button type="button" priority="primary" onClick={this.handleSubmit}>
              {t('Ignore')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default CustomIgnoreCountModal;
