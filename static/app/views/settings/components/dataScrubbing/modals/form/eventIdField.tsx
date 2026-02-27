import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useSourceGroupData} from 'sentry/views/settings/components/dataScrubbing/modals/utils';
import type {SourceSuggestion} from 'sentry/views/settings/components/dataScrubbing/types';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';
import {valueSuggestions} from 'sentry/views/settings/components/dataScrubbing/utils';

import EventIdFieldStatusIcon from './eventIdFieldStatusIcon';

type Props = {
  onSuggestionsLoaded: (suggestions: SourceSuggestion[]) => void;
  orgSlug: string;
  disabled?: boolean;
  projectId?: Project['id'];
};

const suggestionOptions = (orgSlug: string) =>
  apiOptions.as<SourceSuggestion[]>()(
    '/organizations/$organizationIdOrSlug/data-scrubbing-selector-suggestions/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    }
  );

function EventIdField({disabled, orgSlug, projectId, onSuggestionsLoaded}: Props) {
  const {sourceGroupData, saveToSourceGroupData} = useSourceGroupData();
  const queryClient = useQueryClient();
  const lastFetchedEventId = useRef(sourceGroupData.eventId);

  const [eventData, setEventData] = useState({
    value: sourceGroupData.eventId,
    status: sourceGroupData.eventId ? EventIdStatus.LOADED : EventIdStatus.UNDEFINED,
  });

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

  function isEventIdValid(): boolean {
    if (eventData.value && eventData.value.length !== 32) {
      if (eventData.status !== EventIdStatus.INVALID) {
        const newState = {value: eventData.value, status: EventIdStatus.INVALID};
        saveToSourceGroupData(newState);
        setEventData(newState);
      }
      return false;
    }
    return true;
  }

  async function handleUpdateEventId(newEventId: string) {
    if (newEventId === lastFetchedEventId.current) {
      return;
    }

    lastFetchedEventId.current = newEventId;

    if (!newEventId) {
      onSuggestionsLoaded(valueSuggestions);
      const newState = {value: '', status: EventIdStatus.UNDEFINED};
      setEventData(newState);
      saveToSourceGroupData(newState, valueSuggestions);
      return;
    }

    onSuggestionsLoaded(valueSuggestions);
    setEventData({value: newEventId, status: EventIdStatus.LOADING});

    try {
      const query: {eventId: string; projectId?: string} = {eventId: newEventId};
      if (projectId) {
        query.projectId = projectId;
      }

      const {json: suggestions} = await queryClient.fetchQuery(
        suggestionOptions(orgSlug)
      );

      if (suggestions.length > 0) {
        const newState = {value: newEventId, status: EventIdStatus.LOADED};
        onSuggestionsLoaded(suggestions);
        setEventData(newState);
        saveToSourceGroupData(newState, suggestions);
        return;
      }

      const newState = {value: newEventId, status: EventIdStatus.NOT_FOUND};
      onSuggestionsLoaded(valueSuggestions);
      setEventData(newState);
      saveToSourceGroupData(newState, valueSuggestions);
    } catch {
      const newState = {value: newEventId, status: EventIdStatus.ERROR};
      setEventData(newState);
      saveToSourceGroupData(newState);
    }
  }

  const errorMessage = getErrorMessage();

  return (
    <Stack gap="sm" data-test-id="event-id-field">
      <Text bold size="sm">
        {t('Event ID (Optional)')}
      </Text>
      <Text size="sm" variant="muted">
        {t(
          'Providing an event ID will automatically provide you a list of suggested sources'
        )}
      </Text>
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
              handleUpdateEventId(eventData.value);
            }
          }}
          onBlur={event => {
            event.preventDefault();

            if (isEventIdValid()) {
              handleUpdateEventId(eventData.value);
            }
          }}
        />
        <Status>
          <EventIdFieldStatusIcon
            onClickIconClose={() => {
              const newState = {value: '', status: EventIdStatus.UNDEFINED};
              setEventData(newState);
              onSuggestionsLoaded(valueSuggestions);
              saveToSourceGroupData(newState, valueSuggestions);
            }}
            status={eventData.status}
          />
        </Status>
      </Flex>
      {errorMessage && (
        <Text size="sm" variant="danger">
          {errorMessage}
        </Text>
      )}
    </Stack>
  );
}

export default EventIdField;

const StyledInput = styled(Input)`
  flex: 1;
  font-weight: ${p => p.theme.font.weight.sans.regular};
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
