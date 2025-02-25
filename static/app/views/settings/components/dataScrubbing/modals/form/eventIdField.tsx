import {Component} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Input} from 'sentry/components/core/input';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {EventId} from '../../types';
import {EventIdStatus} from '../../types';
import {saveToSourceGroupData} from '../utils';

import EventIdFieldStatusIcon from './eventIdFieldStatusIcon';

type Props = {
  eventId: EventId;
  onUpdateEventId: (eventId: string) => void;
  disabled?: boolean;
};

type State = {
  status: EventIdStatus;
  value: string;
};

class EventIdField extends Component<Props, State> {
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
        return t('This event ID is invalid');
      case EventIdStatus.ERROR:
        return t(
          'An error occurred while fetching the suggestions based on this event ID'
        );
      case EventIdStatus.NOT_FOUND:
        return t('The chosen event ID was not found in projects you have access to');
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
    const {key} = event;

    if (key === 'Enter' && this.isEventIdValid()) {
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
      <FieldGroup
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
      </FieldGroup>
    );
  }
}
export default EventIdField;

const StyledInput = styled(Input)`
  flex: 1;
  font-weight: ${p => p.theme.fontWeightNormal};
  input {
    padding-right: ${space(1.5)};
  }
  margin-bottom: 0;
`;

const Status = styled('div')`
  height: 100%;
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
