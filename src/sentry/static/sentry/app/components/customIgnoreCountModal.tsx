import Modal from 'react-bootstrap/lib/Modal';
import PropTypes from 'prop-types';
import { Component } from 'react';

import {t} from 'app/locale';
import {ResolutionStatusDetails} from 'app/types';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import InputField from 'app/views/settings/components/forms/inputField';
import SelectField from 'app/views/settings/components/forms/selectField';

type CountNames = 'ignoreCount' | 'ignoreUserCount';
type WindowNames = 'ignoreWindow' | 'ignoreUserWindow';

type Props = {
  onSelected: (statusDetails: ResolutionStatusDetails) => void;
  onCanceled: () => void;
  show: boolean;
  label: string;
  countLabel: string;
  countName: CountNames;
  windowName: WindowNames;
  windowChoices: string[] | [number, string][];
};

type State = {
  count: number;
  window: number | null;
};

export default class CustomIgnoreCountModal extends Component<Props, State> {
  static propTypes = {
    onSelected: PropTypes.func,
    onCanceled: PropTypes.func,
    show: PropTypes.bool,
    label: PropTypes.string.isRequired,
    countLabel: PropTypes.string.isRequired,
    countName: PropTypes.string.isRequired,
    windowName: PropTypes.string.isRequired,
    windowChoices: PropTypes.array.isRequired,
  };

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
  };

  handleChange = (name: keyof State, value: number) => {
    this.setState({[name]: value} as State);
  };

  render() {
    const {countLabel, label, show, windowChoices, onCanceled} = this.props;
    const {count, window} = this.state;
    return (
      <Modal show={show} animation={false} onHide={onCanceled}>
        <Modal.Header>
          <h4>{label}</h4>
        </Modal.Header>
        <Modal.Body>
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
            deprecatedSelectControl
            inline={false}
            flexibleControlStateSize
            stacked
            label={t('Time window')}
            value={window}
            name="window"
            onChange={val => this.handleChange('window' as 'window', val)}
            choices={windowChoices}
            placeholder={t('e.g. per hour')}
            allowClear
            help={t('(Optional) If supplied, this rule will apply as a rate of change.')}
          />
        </Modal.Body>
        <Modal.Footer>
          <ButtonBar gap={1}>
            <Button type="button" onClick={onCanceled}>
              {t('Cancel')}
            </Button>
            <Button type="button" priority="primary" onClick={this.handleSubmit}>
              {t('Ignore')}
            </Button>
          </ButtonBar>
        </Modal.Footer>
      </Modal>
    );
  }
}
