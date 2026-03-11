import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Input} from '@sentry/scraps/input';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TextOverflow} from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
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

type FieldProps = {
  'aria-describedby': string;
  'aria-invalid': boolean;
  disabled: boolean;
  id: string;
  name: string;
  onBlur: () => void;
};

type Props = {
  dataset: AllowedDataScrubbingDatasets;
  fieldProps: FieldProps;
  onChange: (value: string) => void;
  value: string;
  onBlur?: (value: string, event: React.FocusEvent<HTMLInputElement>) => void;
  projectId?: Project['id'];
};

export function AttributeField({
  dataset,
  fieldProps,
  onChange,
  value,
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

  const suggestions = useMemo(() => {
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
      fieldProps.onBlur();
    },
    [onBlur, fieldProps]
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
    <Wrapper>
      {traceItemAttributeStringsResult.isLoading &&
      !Object.keys(suggestedAttributeValues).length ? (
        <LoadingIndicator style={{margin: '0 auto'}} size={20} />
      ) : (
        <Fragment>
          <StyledInput
            {...fieldProps}
            type="text"
            aria-label={t('Attribute')}
            placeholder={t('Select or type attribute')}
            value={_field}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
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
  );
}

const Wrapper = styled('div')`
  position: relative;
  width: 100%;
`;

const StyledInput = styled(Input)`
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
  border-radius: ${p => p.theme.space.xs};
  background: ${p => p.theme.tokens.background.primary};
  top: calc(100% + ${p => p.theme.space.xs});
  left: 0;
  z-index: 1002;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
`;

const Suggestion = styled('li')<{active: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.md};
  cursor: pointer;
  background: ${p =>
    p.active ? p.theme.tokens.background.secondary : p.theme.tokens.background.primary};
  :hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
  :active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;
