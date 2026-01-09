import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useProjects from 'sentry/utils/useProjects';
import {
  elideTagBasedAttributes,
  useTraceItemAttributeKeys,
} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  AllowedDataScrubbingDatasets,
  type AttributeSuggestion,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {TraceItemFieldSelector} from 'sentry/views/settings/components/dataScrubbing/utils';

type Props = {
  dataset: AllowedDataScrubbingDatasets;
  onChange: (value: string) => void;
  value: string;
  error?: string;
  onBlur?: (value: string, event: React.FocusEvent<HTMLInputElement>) => void;
  projectId?: Project['id'];
};

export default function AttributeField({
  dataset,
  onChange,
  value,
  error,
  onBlur,
  projectId,
}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const traceItemAttributeStringsResult = useTraceItemAttributeKeys({
    enabled: true,
    type: 'string',
    traceItemType: TraceItemDataset.LOGS,
    projects: project ? [project] : undefined,
  });
  const [suggestedAttributeValues, setSuggestedAttributeValues] = useLocalStorageState(
    `advanced-data-scrubbing.suggested-attribute-values:v2:${projectId ? projectId : 'all'}`,
    {} as TagCollection
  );

  const traceItemFieldSelector = TraceItemFieldSelector.fromSourceString(value);
  const _field = traceItemFieldSelector?.toField() ?? value;

  useEffect(() => {
    if (
      traceItemAttributeStringsResult.attributes &&
      !traceItemAttributeStringsResult.isLoading &&
      !traceItemAttributeStringsResult.error
    ) {
      // This limits the attributes you can see when selecting for pii scrubbing, but we have to currently as tags[] syntax is strictly invalid.
      // We should address this ultimately via fixing the trace item keys endpoint to emit the stored/relay-esque syntax at some point, instead of frontend hacks.
      setSuggestedAttributeValues(
        elideTagBasedAttributes(traceItemAttributeStringsResult.attributes)
      );
    }
  }, [
    onChange,
    traceItemAttributeStringsResult.attributes,
    traceItemAttributeStringsResult.isLoading,
    traceItemAttributeStringsResult.error,
    setSuggestedAttributeValues,
  ]);

  const suggestions: AttributeSuggestion[] = useMemo(() => {
    if (!suggestedAttributeValues) {
      return [];
    }

    const traceItemFields = TraceItemFieldSelector.fromTraceItemResults(
      dataset,
      suggestedAttributeValues
    );

    if (!traceItemFields) {
      return [];
    }

    return [
      ...TraceItemFieldSelector.getAllStaticFields(dataset).map(staticField => ({
        value: staticField.fieldName,
        label: staticField.fieldName,
      })),
      ...traceItemFields.map(field => ({
        value: field.label,
        label:
          TraceItemFieldSelector.fromField(dataset, field.key)?.toLabel() ?? field.label,
      })),
    ];
  }, [dataset, suggestedAttributeValues]);

  const filteredSuggestions = useMemo(() => {
    if (!_field) {
      return suggestions;
    }
    return suggestions.filter(suggestion =>
      suggestion.value.toLowerCase().includes(_field.toLowerCase())
    );
  }, [suggestions, _field]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
      setShowSuggestions(true);
      setActiveSuggestion(0);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    setShowSuggestions(true);
  }, []);

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setTimeout(() => {
        setShowSuggestions(false);
      }, 150);
      onBlur?.(event.target.value, event);
    },
    [onBlur]
  );

  const handleClickSuggestion = useCallback(
    (suggestion: AttributeSuggestion) => {
      onChange(suggestion.value);
      setShowSuggestions(false);
      setActiveSuggestion(0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || filteredSuggestions.length === 0) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveSuggestion(prev =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveSuggestion(prev => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredSuggestions[activeSuggestion]) {
            handleClickSuggestion(filteredSuggestions[activeSuggestion]);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
        default:
          break;
      }
    },
    [showSuggestions, filteredSuggestions, activeSuggestion, handleClickSuggestion]
  );

  return (
    <FieldGroup
      label={t('Attribute')}
      help={t('The attribute to scrub')}
      inline={false}
      flexibleControlStateSize
      stacked
      required
      showHelpInTooltip
    >
      <Wrapper>
        {traceItemAttributeStringsResult.isLoading &&
        !Object.keys(suggestedAttributeValues).length ? (
          <LoadingIndicator style={{margin: '0 auto'}} size={20} />
        ) : (
          <Fragment>
            <StyledInput
              type="text"
              placeholder={t('Select or type attribute')}
              value={_field}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              error={!!error}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <Suggestions>
                {filteredSuggestions.slice(0, 50).map((suggestion, index) => (
                  <Suggestion
                    key={suggestion.value}
                    active={index === activeSuggestion}
                    onClick={() => handleClickSuggestion(suggestion)}
                  >
                    <TextOverflow>{suggestion.value}</TextOverflow>
                  </Suggestion>
                ))}
              </Suggestions>
            )}
          </Fragment>
        )}
      </Wrapper>
    </FieldGroup>
  );
}

const Wrapper = styled('div')`
  position: relative;
  width: 100%;
`;

const StyledInput = styled(Input)<{error: boolean}>`
  width: 100%;
`;

const Suggestions = styled('ul')`
  position: absolute;
  width: 100%;
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
  box-shadow: 0 2px 0 rgba(37, 11, 54, 0.04);
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 0 0 ${space(0.5)} ${space(0.5)};
  background: ${p => p.theme.tokens.background.primary};
  top: 100%;
  left: 0;
  z-index: 1002;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
`;

const Suggestion = styled('li')<{active: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSize.md};
  cursor: pointer;
  background: ${p =>
    p.active ? p.theme.backgroundSecondary : p.theme.tokens.background.primary};
  :hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;
