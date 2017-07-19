import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {Select2Field} from './forms';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    onSelected: React.PropTypes.func,
    onCanceled: React.PropTypes.func,
    show: React.PropTypes.bool,
    label: React.PropTypes.string.isRequired,
    countLabel: React.PropTypes.string.isRequired,
    countName: React.PropTypes.string.isRequired,
    windowName: React.PropTypes.string.isRequired,
    windowChoices: React.PropTypes.array.isRequired
  },

  getInitialState() {
    return {
      count: 100,
      window: ''
    };
  },

  onSubmit() {
    this.props.onSelected({
      [this.props.countName]: this.state.count,
      [this.props.windowName]: this.state.window
    });
  },

  onChange(name, value) {
    this.setState({[name]: value});
  },

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
              <h6 className="nav-header">
                {this.props.countLabel}
              </h6>
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
              <h6 className="nav-header">
                {t('Time window')}
              </h6>
              <Select2Field
                className="form-control"
                value={window}
                name="window"
                onChange={v => this.onChange('window', v)}
                style={{padding: '3px 10px'}}
                choices={[['', ' '], ...this.props.windowChoices]}
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
            onClick={this.props.onCanceled}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={this.onSubmit}>
            {t('Ignore')}
          </button>
        </div>
      </Modal>
    );
  }
});
