import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useSourceGroupData} from 'sentry/views/settings/components/dataScrubbing/modals/utils';
import type {SourceSuggestion} from 'sentry/views/settings/components/dataScrubbing/types';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';
import {valueSuggestions} from 'sentry/views/settings/components/dataScrubbing/utils';

import {EventIdFieldStatusIcon} from './eventIdFieldStatusIcon';

const suggestionOptions = (
  orgSlug: string,
  query: {eventId: string; projectId?: string}
) =>
  apiOptions.as<{suggestions: SourceSuggestion[]}>()(
    '/organizations/$organizationIdOrSlug/data-scrubbing-selector-suggestions/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query,
      staleTime: 0,
    }
  );

type FieldProps = {
  'aria-describedby': string;
  'aria-invalid': boolean;
  disabled: boolean;
  id: string;
  name: string;
  onBlur: () => void;
};

type Props = {
  fieldProps: FieldProps;
  onChange: (value: string) => void;
  onErrorChange: (error: string | undefined) => void;
  onSuggestionsLoaded: (suggestions: SourceSuggestion[]) => void;
  orgSlug: string;
  value: string;
  projectId?: string;
};

export function EventIdField({
  fieldProps,
  value,
  onChange,
  onSuggestionsLoaded,
  onErrorChange,
  orgSlug,
  projectId,
}: Props) {
  const queryClient = useQueryClient();
  const {sourceGroupData, saveToSourceGroupData} = useSourceGroupData();
  const [status, setStatus] = useState<EventIdStatus>(() =>
    sourceGroupData.eventId ? EventIdStatus.LOADED : EventIdStatus.UNDEFINED
  );

  const handleUpdateEventId = useCallback(
    async (eventId: string) => {
      if (!eventId) {
        setStatus(EventIdStatus.UNDEFINED);
        onErrorChange(undefined);
        onSuggestionsLoaded(valueSuggestions);
        saveToSourceGroupData({value: '', status: EventIdStatus.UNDEFINED});
        return;
      }

      if (eventId.length !== 32) {
        setStatus(EventIdStatus.INVALID);
        onErrorChange(t('This event ID is invalid'));
        return;
      }

      setStatus(EventIdStatus.LOADING);
      onErrorChange(undefined);

      try {
        const data = await queryClient.fetchQuery({
          ...suggestionOptions(orgSlug, {
            eventId,
            ...(projectId ? {projectId} : {}),
          }),
          retry: false,
        });

        const {suggestions} = data.json;

        if (suggestions.length > 0) {
          setStatus(EventIdStatus.LOADED);
          onErrorChange(undefined);
          onSuggestionsLoaded(suggestions);
          saveToSourceGroupData(
            {value: eventId, status: EventIdStatus.LOADED},
            suggestions
          );
        } else {
          setStatus(EventIdStatus.NOT_FOUND);
          onErrorChange(
            t('The chosen event ID was not found in projects you have access to')
          );
          onSuggestionsLoaded(valueSuggestions);
          saveToSourceGroupData({value: '', status: EventIdStatus.UNDEFINED});
        }
      } catch {
        setStatus(EventIdStatus.ERROR);
        onErrorChange(
          t('An error occurred while fetching the suggestions based on this event ID')
        );
        onSuggestionsLoaded(valueSuggestions);
        saveToSourceGroupData({value: '', status: EventIdStatus.UNDEFINED});
      }
    },
    [
      queryClient,
      orgSlug,
      projectId,
      onSuggestionsLoaded,
      onErrorChange,
      saveToSourceGroupData,
    ]
  );

  const handleBlur = useCallback(() => {
    handleUpdateEventId(value);
    fieldProps.onBlur();
  }, [handleUpdateEventId, value, fieldProps]);

  return (
    <Flex align="center" position="relative" flexGrow={1}>
      <StyledInput
        {...fieldProps}
        type="text"
        value={value}
        placeholder={t('XXXXXXXXXXXXXX')}
        onChange={event => {
          const newValue = event.target.value.replace(/-/g, '').trim();
          if (status !== EventIdStatus.UNDEFINED) {
            setStatus(EventIdStatus.UNDEFINED);
            onErrorChange(undefined);
          }
          onChange(newValue);
        }}
        onBlur={handleBlur}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleBlur();
          }
        }}
      />
      <Status>
        <EventIdFieldStatusIcon status={status} />
      </Status>
    </Flex>
  );
}

const StyledInput = styled(Input)`
  flex: 1;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  input {
    padding-right: ${p => p.theme.space.lg};
  }
  margin-bottom: 0;
`;

const Status = styled('div')`
  height: 100%;
  position: absolute;
  right: ${p => p.theme.space.lg};
  top: 0;
  display: flex;
  align-items: center;
`;
