import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {SelectField} from 'app/components/forms';
import {t} from 'app/locale';

export default class CustomIgnoreCountModal extends React.Component {
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

  constructor(...args) {
    super(...args);
    this.state = {
      count: 100,
      window: '',
    };
  }

  onSubmit = () => {
    this.props.onSelected({
      [this.props.countName]: this.state.count,
      [this.props.windowName]: this.state.window,
    });
  };

  onChange = (name, value) => {
    this.setState({[name]: value});
  };

  render() {
    let {count, window} = this.state;
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
                onChange={e => this.onChange('count', e.target.value)}
                style={{padding: '3px 10px'}}
                required={true}
                placeholder={t('e.g. 100')}
              />
            </div>
            <div className="control-group m-b-1">
              <h6 className="nav-header">{t('Time window')}</h6>
              <SelectField
                value={window}
                name="window"
                onChange={v => this.onChange('window', v)}
                choices={this.props.windowChoices}
                placeholder={t('e.g. per hour')}
                allowClear={true}
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
