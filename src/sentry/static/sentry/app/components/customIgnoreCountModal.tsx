import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {SelectField} from 'app/components/forms';
import {t} from 'app/locale';

type Props = {
  onSelected: (statusDetails: {[key: string]: number}) => void;
  onCanceled: () => void;
  show: boolean;
  label: string;
  countLabel: string;
  countName: string;
  windowName: string;
  windowChoices: string[];
};

type State = {
  count: number;
  window: number | null;
};

export default class CustomIgnoreCountModal extends React.Component<Props, State> {
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

  onSubmit = () => {
    const {count, window} = this.state;
    const {countName, windowName} = this.props;

    const statusDetails: {[key: string]: number} = {[countName]: count};
    if (window) {
      statusDetails[windowName] = window;
    }
    this.props.onSelected(statusDetails);
  };

  onChange = (name: keyof State, value: number) => {
    this.setState({[name]: value} as State);
  };

  render() {
    const {count, window} = this.state;
    return (
      <Modal show={this.props.show} animation={false} onHide={this.props.onCanceled}>
        <div className="modal-header">
          <h4>{this.props.label}</h4>
        </div>
        <div className="modal-body">
          <form className="m-b-1">
            <div className="control-group">
              <h6 className="nav-header">{this.props.countLabel}</h6>
              <input
                className="form-control"
                type="number"
                value={count}
                onChange={e => this.onChange('count' as 'count', Number(e.target.value))}
                style={{padding: '3px 10px'}}
                required
                placeholder={t('e.g. 100')}
              />
            </div>
            <div className="control-group m-b-1">
              <h6 className="nav-header">{t('Time window')}</h6>
              <SelectField
                value={window}
                name="window"
                onChange={v => this.onChange('window' as 'window', v)}
                choices={this.props.windowChoices}
                placeholder={t('e.g. per hour')}
                allowClear
                help={t(
                  '(Optional) If supplied, this rule will apply as a rate of change.'
                )}
              />
            </div>
          </form>
        </div>
        <div className="modal-footer m-t-1">
          <button
            type="button"
            className="btn btn-default"
            onClick={this.props.onCanceled}
          >
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={this.onSubmit}>
            {t('Ignore')}
          </button>
        </div>
      </Modal>
    );
  }
}
