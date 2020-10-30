import React from 'react';
import moment from 'moment';
import Modal from 'react-bootstrap/lib/Modal';
import {sprintf} from 'sprintf-js';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {IconWarning} from 'app/icons';
import ButtonBar from 'app/components/buttonBar';
import {ResolutionStatusDetails} from 'app/types';
import {t} from 'app/locale';

const defaultProps = {
  label: t('Ignore this issue until \u2026'),
};

type Props = {
  show: boolean;
  onSelected: (details: ResolutionStatusDetails) => void;
  onCanceled: () => void;
} & typeof defaultProps;

type State = {
  dateWarning: boolean;
};

export default class CustomIgnoreDurationModal extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state = {
    dateWarning: false,
  };
  snoozeDateInputRef = React.createRef<HTMLInputElement>();

  snoozeTimeInputRef = React.createRef<HTMLInputElement>();

  selectedIgnoreMinutes = () => {
    const dateStr = this.snoozeDateInputRef.current?.value; // YYYY-MM-DD
    const timeStr = this.snoozeTimeInputRef.current?.value; // HH:MM
    if (dateStr && timeStr) {
      const selectedDate = moment.utc(dateStr + ' ' + timeStr);
      if (selectedDate.isValid()) {
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
    const {show, onCanceled, label} = this.props;

    return (
      <Modal show={show} animation={false} onHide={onCanceled}>
        <Modal.Header>
          <h4>{label}</h4>
        </Modal.Header>
        <Modal.Body>
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
        </Modal.Body>
        {this.state.dateWarning && (
          <Alert icon={<IconWarning size="md" />} type="error">
            {t('Please enter a valid date in the future')}
          </Alert>
        )}
        <Modal.Footer>
          <ButtonBar gap={1}>
            <Button type="button" priority="default" onClick={this.props.onCanceled}>
              {t('Cancel')}
            </Button>
            <Button type="button" priority="primary" onClick={this.snoozeClicked}>
              {t('Ignore')}
            </Button>
          </ButtonBar>
        </Modal.Footer>
      </Modal>
    );
  }
}
