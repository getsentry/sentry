import {Fragment, useRef, useState} from 'react';
import moment from 'moment-timezone';
// @ts-ignore TS(7016): Could not find a declaration file for module 'spri... Remove this comment to see the full error message
import {sprintf} from 'sprintf-js';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import type {IgnoredStatusDetails} from 'sentry/types/group';

type Props = ModalRenderProps & {
  onSelected: (details: IgnoredStatusDetails) => void;
};

export default function CustomIgnoreDurationModal(props: Props) {
  const [dateWarning, setDateWarning] = useState<boolean>(false);
  const {Header, Body, Footer, onSelected, closeModal} = props;
  const label = t('Ignore this issue until \u2026');

  const snoozeDateInputRef = useRef<HTMLInputElement>(null);

  const snoozeTimeInputRef = useRef<HTMLInputElement | null>(null);

  const selectedIgnoreMinutes = () => {
    const dateStr = snoozeDateInputRef.current?.value; // YYYY-MM-DD
    const timeStr = snoozeTimeInputRef.current?.value; // HH:MM
    if (dateStr && timeStr) {
      const selectedDate = moment.utc(dateStr + ' ' + timeStr);
      if (selectedDate.isValid()) {
        const now = moment.utc();
        return selectedDate.diff(now, 'minutes');
      }
    }
    return 0;
  };

  const snoozeClicked = () => {
    const minutes = selectedIgnoreMinutes();

    if (minutes <= 0) {
      setDateWarning(minutes <= 0);
      return;
    }

    onSelected({ignoreDuration: minutes});
    closeModal();
  };

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
    <Fragment>
      <Header>{label}</Header>
      <Body>
        <form className="form-horizontal">
          <div className="control-group">
            <h6 className="nav-header">{t('Date')}</h6>
            <input
              className="form-control"
              type="date"
              id="snooze-until-date"
              defaultValue={defaultDateVal}
              ref={snoozeDateInputRef}
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
              ref={snoozeTimeInputRef}
              style={{padding: '0 10px'}}
              required
            />
          </div>
        </form>
      </Body>
      {dateWarning && (
        <Alert type="error" showIcon>
          {t('Please enter a valid date in the future')}
        </Alert>
      )}
      <Footer>
        <ButtonBar gap={1}>
          <Button priority="default" onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <Button priority="primary" onClick={snoozeClicked}>
            {t('Ignore')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}
