import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import Modal from 'react-bootstrap/lib/Modal';
import {sprintf} from 'sprintf-js';

import {t} from 'app/locale';

export default class CustomIgnoreDurationModal extends React.Component {
  static propTypes = {
    onSelected: PropTypes.func,
    onCanceled: PropTypes.func,
    show: PropTypes.bool,
    label: PropTypes.string,
  };

  static defaultProps = {
    label: t('Ignore this issue until ..'),
  };

  constructor(...args) {
    super(...args);
    this.state = {
      dateWarning: false,
    };
    this.snoozeDateInputRef = React.createRef();
    this.snoozeTimeInputRef = React.createRef();
  }

  selectedIgnoreMinutes = () => {
    const dateStr = this.snoozeDateInputRef.current.value; // YYYY-MM-DD
    const timeStr = this.snoozeTimeInputRef.current.value; // HH:MM
    if (dateStr && timeStr) {
      const selectedDate = moment.utc(dateStr + ' ' + timeStr);
      if (!isNaN(selectedDate)) {
        const now = moment.utc();
        return selectedDate.diff(now, 'minutes');
      }
    }
    return 0;
  };

  snoozeClicked = () => {
    const minutes = this.selectedIgnoreMinutes();

    this.setState({
      dateWarning: minutes <= 0,
    });

    if (minutes > 0) {
      this.props.onSelected({ignoreDuration: minutes});
    }
  };

  render() {
    // Give the user a sane starting point to select a date
    // (prettier than the empty date/time inputs):
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    defaultDate.setSeconds(0);
    defaultDate.setMilliseconds(0);

    const defaultDateVal = sprintf(
      '%d-%02d-%02d',
      defaultDate.getUTCFullYear(),
      defaultDate.getUTCMonth() + 1,
      defaultDate.getUTCDate()
    );

    const defaultTimeVal = sprintf('%02d:00', defaultDate.getUTCHours());

    return (
      <Modal show={this.props.show} animation={false} onHide={this.props.onCanceled}>
        <div className="modal-header">
          <h4>{this.props.label}</h4>
        </div>
        <div className="modal-body">
          <form className="form-horizontal">
            <div className="control-group">
              <h6 className="nav-header">{t('Date')}</h6>
              <input
                className="form-control"
                type="date"
                id="snooze-until-date"
                defaultValue={defaultDateVal}
                ref={this.snoozeDateInputRef}
                required
                style={{padding: '0 10px'}}
              />
            </div>
            <div className="control-group m-b-1">
              <h6 className="nav-header">{t('Time (UTC)')}</h6>
              <input
                className="form-control"
                type="time"
                id="snooze-until-time"
                defaultValue={defaultTimeVal}
                ref={this.snoozeTimeInputRef}
                style={{padding: '0 10px'}}
                required
              />
            </div>
          </form>
        </div>
        {this.state.dateWarning && (
          <div className="alert alert-error" style={{'margin-top': '5px'}}>
            {t('Please enter a valid date in the future')}
          </div>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-default"
            onClick={this.props.onCanceled}
          >
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={this.snoozeClicked}>
            {t('Ignore')}
          </button>
        </div>
      </Modal>
    );
  }
}
