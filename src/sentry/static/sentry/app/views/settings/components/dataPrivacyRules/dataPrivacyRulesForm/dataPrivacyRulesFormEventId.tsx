import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import TextField from 'app/components/forms/textField';
import {t} from 'app/locale';
import space from 'app/styles/space';
import ControlState from 'app/views/settings/components/forms/field/controlState';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';

import DataPrivacyRulesPanelFormField from './dataPrivacyRulesFormField';
import {EventIdStatus} from './types';

type EventId = {
  value: string;
  status?: EventIdStatus;
};

type Props = {
  onUpdateEventId: (eventId: string) => void;
  eventId: EventId;
  disabled?: boolean;
};

const loadEventIdStatus = (status?: EventIdStatus) => {
  switch (status) {
    case EventIdStatus.INVALID:
      addErrorMessage(t("That's not a valid event ID"));
      break;
    case EventIdStatus.ERROR:
      addErrorMessage(t('Something went wrong while fetching the suggestions'));
      break;
    case EventIdStatus.NOT_FOUND:
      addErrorMessage(t('Event ID not found in projects you have access to'));
      break;
    case EventIdStatus.LOADED:
      addSuccessMessage(t('Successfully loaded event for autocompletion'));
      break;
    default:
  }
};

type State = {
  value: string;
  status?: EventIdStatus;
};

class DataPrivacyRulesFormEventId extends React.Component<Props, State> {
  state = {
    value: this.props.eventId.value,
    status: this.props.eventId.status,
  };

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.eventId, this.props.eventId)) {
      this.loadState();
    }
  }

  loadState = () => {
    this.setState(
      {
        ...this.props.eventId,
      },
      this.loadStatus
    );
  };

  loadStatus = () => {
    loadEventIdStatus(this.state.status);
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
      this.setState({status: EventIdStatus.INVALID}, this.loadStatus);
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

  render() {
    const {disabled} = this.props;
    const {value, status} = this.state;

    return (
      <DataPrivacyRulesPanelFormField
        label={t('Event ID (Optional)')}
        tooltipInfo={t(
          'Providing an event ID will automatically provide you a list of suggested sources'
        )}
      >
        <EventIdFieldWrapper>
          <StyledTextField
            name="eventId"
            disabled={disabled}
            value={value}
            placeholder={t('XXXXXXXXXXXXXX')}
            onChange={this.handleChange}
            onKeyDown={this.handleKeyDown}
            onBlur={this.handleBlur}
            showStatus={status !== EventIdStatus.LOADED}
          />
          <Status>
            {status === EventIdStatus.LOADING && <ControlState isSaving />}
            {status === EventIdStatus.INVALID && <ControlState error />}
            {status === EventIdStatus.ERROR && <ControlState error />}
            {status === EventIdStatus.NOT_FOUND && <ControlState error />}
          </Status>
        </EventIdFieldWrapper>
      </DataPrivacyRulesPanelFormField>
    );
  }
}
export default DataPrivacyRulesFormEventId;

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
  position: absolute;
  right: 0;
`;

const EventIdFieldWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
