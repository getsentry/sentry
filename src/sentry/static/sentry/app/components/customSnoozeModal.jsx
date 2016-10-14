import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {t} from '../locale';
import {sprintf} from 'sprintf-js';

const CustomSnoozeModal = React.createClass({
  propTypes: {
    onSelected: React.PropTypes.func,
    onCanceled: React.PropTypes.func,
    show: React.PropTypes.bool,
  },

  getInitialState() {
    return {
      dateWarning: false
    };
  },

  selectedSnoozeMinutes() {
    const dateStr = this.refs.snoozeDateInput.value; // YYYY-MM-DD
    const timeStr = this.refs.snoozeTimeInput.value; // HH:MM
    if (dateStr && timeStr) {
      const selectedDate = new Date(dateStr + 'T' + timeStr); // poor man's ISO datetime
      if (!isNaN(selectedDate)) {
        const now = new Date();
        const millis = selectedDate.getTime() - now.getTime();
        const minutes = parseInt(Math.ceil(millis / 1000.0 / 60.0), 10);
        return minutes;
      }
    }
    return 0;
  },

  snoozeClicked() {
    const minutes = this.selectedSnoozeMinutes();

    this.setState({
      dateWarning: minutes <= 0
    });

    if (minutes > 0) {
      this.props.onSelected(minutes);
    }
  },

  render() {
    // Give the user a sane starting point to select a date
    // (prettier than the empty date/time inputs):
    let defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    defaultDate.setSeconds(0);
    defaultDate.setMilliseconds(0);

    const defaultDateVal = sprintf('%d-%02d-%02d',
        defaultDate.getUTCFullYear(),
        defaultDate.getUTCMonth() + 1,
        defaultDate.getUTCDate());

    const defaultTimeVal = sprintf('%02d:00',
        defaultDate.getUTCHours());

    return (
      <Modal show={this.props.show} animation={false} bsSize="sm">
        <div className="modal-header">
          <h4>{t('Ignore until:')}</h4>
        </div>
        <div className="modal-body">
          <form className="form-horizontal">
            <div className="form-group">
              <label htmlFor="snooze-until-date"
                     className="col-sm-4 control-label">{t('Date:')}</label>
                   <div className="col-sm-8">
                <input className="form-control"
                       type="date"
                       id="snooze-until-date"
                       defaultValue={defaultDateVal}
                       ref="snoozeDateInput"
                       style={{padding: '0 10px'}}
                       />
              </div>
            </div>
            <div className="form-group m-b-1">
              <label htmlFor="snooze-until-time"
                     className="col-sm-4 control-label">{t('Time (UTC):')}</label>
                   <div className="col-sm-8">
                <input className="form-control"
                       type="time"
                       id="snooze-until-time"
                       defaultValue={defaultTimeVal}
                       ref="snoozeTimeInput"
                       style={{padding: '0 10px'}}
                       />
              </div>
            </div>
          </form>
        </div>
        {this.state.dateWarning &&
          <div className="alert alert-error" style={{'margin-top': '5px'}}>
            {t('Please enter a valid date in the future')}
          </div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-default"
                  onClick={this.props.onCanceled}>{t('Cancel')}</button>
          <button type="button" className="btn btn-primary"
                  onClick={this.snoozeClicked}>{t('Ignore')}</button>
        </div>
      </Modal>
    );
  },

});

export default CustomSnoozeModal;
