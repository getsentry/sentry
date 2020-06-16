import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import TextField from 'app/components/forms/textField';
import {t} from 'app/locale';
import space from 'app/styles/space';

import FormField from './formField';
import EventIdFieldStatusIcon from './eventIdFieldStatusIcon';
import {EventIdStatus, EventId} from '../types';

type Props = {
  onUpdateEventId: (eventId: string) => void;
  eventId?: EventId;
  disabled?: boolean;
};

type State = {
  value: string;
  status?: EventIdStatus;
};

class EventIdField extends React.Component<Props, State> {
  state = {
    value: this.props.eventId?.value || '',
    status: this.props.eventId?.status,
  };

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.eventId, this.props.eventId)) {
      this.loadState();
    }
  }

  loadState = () => {
    this.setState({
      ...this.props.eventId,
    });
  };

  handleChange = (value: string) => {
    const eventId = value.replace(/-/g, '').trim();

    if (eventId !== this.state.value) {
      this.setState({
        value: eventId,
        status: undefined,
      });
    }
  };

  isEventIdValid = (): boolean => {
    const {value} = this.state;

    if (value && value.length !== 32) {
      this.setState({status: EventIdStatus.INVALID});
      return false;
    }

    return true;
  };

  handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    event.preventDefault();

    if (this.isEventIdValid()) {
      this.props.onUpdateEventId(this.state.value);
    }
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const {keyCode} = event;

    if (keyCode === 13 && this.isEventIdValid()) {
      this.props.onUpdateEventId(this.state.value);
    }
  };

  handleClickIconClose = () => {
    this.setState({
      value: '',
      status: undefined,
    });
  };

  getErrorMessage = (): string | undefined => {
    const {status} = this.state;

    switch (status) {
      case EventIdStatus.INVALID:
        return t('This event ID is invalid.');
      case EventIdStatus.ERROR:
        return t(
          'An error occurred while fetching the suggestions based on this Event ID.'
        );
      case EventIdStatus.NOT_FOUND:
        return t('The chosen event ID was not found in projects you have access to.');
      default:
        return undefined;
    }
  };

  render() {
    const {disabled} = this.props;
    const {value, status} = this.state;

    return (
      <FormField
        label={t('Event ID (Optional)')}
        tooltipInfo={t(
          'Providing an event ID will automatically provide you a list of suggested sources'
        )}
      >
        <FieldWrapper>
          <StyledTextField
            name="eventId"
            disabled={disabled}
            value={value}
            placeholder={t('XXXXXXXXXXXXXX')}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
            onBlur={this.handleBlur}
            showStatus={status !== EventIdStatus.LOADED}
            error={this.getErrorMessage()}
          />
          <Status>
            <EventIdFieldStatusIcon
              onClickIconClose={this.handleClickIconClose}
              status={status}
            />
          </Status>
        </FieldWrapper>
      </FormField>
    );
  }
}
export default EventIdField;

const StyledTextField = styled(TextField)<{showStatus: boolean}>`
  flex: 1;
  font-weight: 400;
  input {
    height: 40px;
    padding-right: ${p => (p.showStatus ? space(4) : space(1.5))};
  }
  margin-bottom: 0;
`;

const Status = styled('div')`
  height: 40px;
  position: absolute;
  right: ${space(1.5)};
  top: 0;
  display: flex;
  align-items: center;
`;

const FieldWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
