import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import Input from 'app/views/settings/components/forms/controls/input';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Field from 'app/views/settings/components/forms/field';

import EventIdFieldStatusIcon from './eventIdFieldStatusIcon';
import {EventIdStatus, EventId} from '../../types';
import {saveToSourceGroupData} from '../utils';

type Props = {
  onUpdateEventId: (eventId: string) => void;
  eventId: EventId;
  disabled?: boolean;
};

type State = {
  value: string;
  status: EventIdStatus;
};

class EventIdField extends React.Component<Props, State> {
  state: State = {...this.props.eventId};

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.eventId, this.props.eventId)) {
      this.loadState();
    }
  }

  loadState() {
    this.setState({
      ...this.props.eventId,
    });
  }

  getErrorMessage(): string | undefined {
    const {status} = this.state;

    switch (status) {
      case EventIdStatus.INVALID:
        return t('This event ID is invalid.');
      case EventIdStatus.ERROR:
        return t(
          'An error occurred while fetching the suggestions based on this event ID.'
        );
      case EventIdStatus.NOT_FOUND:
        return t('The chosen event ID was not found in projects you have access to.');
      default:
        return undefined;
    }
  }

  isEventIdValid(): boolean {
    const {value, status} = this.state;

    if (value && value.length !== 32) {
      if (status !== EventIdStatus.INVALID) {
        saveToSourceGroupData({value, status});
        this.setState({status: EventIdStatus.INVALID});
      }

      return false;
    }

    return true;
  }

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const eventId = event.target.value.replace(/-/g, '').trim();

    if (eventId !== this.state.value) {
      this.setState({
        value: eventId,
        status: EventIdStatus.UNDEFINED,
      });
    }
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
      status: EventIdStatus.UNDEFINED,
    });
  };

  render() {
    const {disabled} = this.props;
    const {value, status} = this.state;

    return (
      <Field
        data-test-id="event-id-field"
        label={t('Event ID (Optional)')}
        help={t(
          'Providing an event ID will automatically provide you a list of suggested sources'
        )}
        inline={false}
        error={this.getErrorMessage()}
        flexibleControlStateSize
        stacked
        showHelpInTooltip
      >
        <FieldWrapper>
          <StyledInput
            type="text"
            name="eventId"
            disabled={disabled}
            value={value}
            placeholder={t('XXXXXXXXXXXXXX')}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
            onBlur={this.handleBlur}
          />
          <Status>
            <EventIdFieldStatusIcon
              onClickIconClose={this.handleClickIconClose}
              status={status}
            />
          </Status>
        </FieldWrapper>
      </Field>
    );
  }
}
export default EventIdField;

const StyledInput = styled(Input)`
  flex: 1;
  font-weight: 400;
  input {
    padding-right: ${space(1.5)};
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
