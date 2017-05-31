import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    onSelected: React.PropTypes.func,
    onCanceled: React.PropTypes.func,
    show: React.PropTypes.bool,
    label: React.PropTypes.string.isRequired,
    noun: React.PropTypes.string.isRequired,
    countName: React.PropTypes.string.isRequired,
    windowName: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      count: 100,
      window: 1
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
      <Modal show={this.props.show} animation={false} bsSize="sm">
        <div className="modal-header">
          <h4>{t('Custom Ignore Rule')}</h4>
        </div>
        <div className="modal-body">
          <h6>{t('Ignore Until')}</h6>
          <form className="form-horizontal">
            <div className="control-group form-group">
              <label className="control-label">
                {this.props.label}
              </label>
              <div className="col-xs-6">
                <input
                  className="form-control"
                  type="number"
                  value={count}
                  onChange={e => this.onChange('count', e.target.value)}
                  style={{padding: '0 10px'}}
                />
              </div>
              <div className="col-xs-6">{this.props.noun}</div>
            </div>
            <div className="control-group form-group m-b-1">
              <label className="control-label">
                {t('Within a time window (optional) ..')}
              </label>
              <div className="col-xs-6">
                <input
                  className="form-control"
                  type="number"
                  value={window}
                  onChange={e => this.onChange('window', e.target.value)}
                  style={{padding: '0 10px'}}
                />
              </div>
              <div className="col-xs-6">hour(s)</div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
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
