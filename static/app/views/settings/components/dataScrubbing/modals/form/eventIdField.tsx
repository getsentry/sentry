import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Input} from 'sentry/components/core/input';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useSourceGroupData} from 'sentry/views/settings/components/dataScrubbing/modals/utils';
import type {EventId} from 'sentry/views/settings/components/dataScrubbing/types';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';

import EventIdFieldStatusIcon from './eventIdFieldStatusIcon';

type Props = {
  eventId: EventId;
  onUpdateEventId: (eventId: string) => void;
  disabled?: boolean;
};

function EventIdField({disabled, eventId, onUpdateEventId}: Props) {
  const [eventData, setEventData] = useState<EventId>(eventId);
  const {saveToSourceGroupData} = useSourceGroupData();

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setEventData(eventId);
  }, [eventId]);

  function getErrorMessage(): string | undefined {
    switch (eventData.status) {
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

  function isEventIdValid() {
    if (eventData.value && eventData.value.length !== 32) {
      if (eventData.status !== EventIdStatus.INVALID) {
        saveToSourceGroupData(eventData);
        setEventData({...eventData, status: EventIdStatus.INVALID});
      }

      return false;
    }

    return true;
  }

  return (
    <FieldGroup
      data-test-id="event-id-field"
      label={t('Event ID (Optional)')}
      help={t(
        'Providing an event ID will automatically provide you a list of suggested sources'
      )}
      inline={false}
      error={getErrorMessage()}
      flexibleControlStateSize
      stacked
      showHelpInTooltip
    >
      <Flex align="center" position="relative">
        <StyledInput
          type="text"
          name="eventId"
          disabled={disabled}
          value={eventData.value}
          placeholder={t('XXXXXXXXXXXXXX')}
          onChange={event => {
            const newEventId = event.target.value.replace(/-/g, '').trim();

            if (newEventId !== eventData.value) {
              setEventData({
                value: newEventId,
                status: EventIdStatus.UNDEFINED,
              });
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && isEventIdValid()) {
              onUpdateEventId(eventData.value);
            }
          }}
          onBlur={event => {
            event.preventDefault();

            if (isEventIdValid()) {
              onUpdateEventId(eventData.value);
            }
          }}
        />
        <Status>
          <EventIdFieldStatusIcon
            onClickIconClose={() => {
              setEventData({
                value: '',
                status: EventIdStatus.UNDEFINED,
              });
            }}
            status={eventData.status}
          />
        </Status>
      </Flex>
    </FieldGroup>
  );
}

export default EventIdField;

const StyledInput = styled(Input)`
  flex: 1;
  font-weight: ${p => p.theme.fontWeight.normal};
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
