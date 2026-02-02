import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {prettifyTagKey} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';

export function WidgetBuilderXAxisSelector() {
  const {state, dispatch} = useWidgetBuilderContext();
  const organization = useOrganization();
  const tags: TagCollection = useTags();

  // Only use string tags for categorical X-axis (numeric values don't make good categories)
  const {tags: stringSpanTags} = useTraceItemTags('string');

  const datasetConfig = useMemo(() => getDatasetConfig(state.dataset), [state.dataset]);

  // Get string field options for X-axis categories.
  // Only string fields make sense as categorical X-axis values (e.g., browser, country, transaction).
  // Numeric fields would create too many unique categories and are better suited for Y-axis aggregates.
  const fieldOptions = useMemo(() => {
    if (
      state.dataset === WidgetType.SPANS ||
      state.dataset === WidgetType.LOGS ||
      state.dataset === WidgetType.TRACEMETRICS
    ) {
      // For EAP datasets, use only string tags
      return Object.values(stringSpanTags).map(tag => ({
        label: prettifyTagKey(tag.name),
        value: tag.key,
      }));
    }

    // For other datasets, use getGroupByFieldOptions and filter for string types only
    if (datasetConfig.getGroupByFieldOptions) {
      const options = datasetConfig.getGroupByFieldOptions(organization, tags);
      return Object.values(options)
        .filter(option => {
          // Exclude functions and equations (they don't have dataType)
          if (
            option.value.kind === FieldValueKind.FUNCTION ||
            option.value.kind === FieldValueKind.EQUATION
          ) {
            return false;
          }
          // Only include string fields
          return option.value.meta.dataType === 'string';
        })
        .map(option => ({
          label: option.value.meta.name,
          value: option.value.meta.name,
        }));
    }

    return [];
  }, [state.dataset, datasetConfig, organization, tags, stringSpanTags]);

  // Extract the current X-axis field from state.fields.
  // For categorical bars, state.fields contains both X-axis fields (FIELD kind)
  // and aggregates (FUNCTION kind). We only show/manage the FIELD entries here.
  const currentXAxisField = useMemo(() => {
    const fieldEntry = state.fields?.find(f => f.kind === FieldValueKind.FIELD);
    return fieldEntry?.field ?? '';
  }, [state.fields]);

  const handleXAxisChange = (option: {value: string | number} | undefined) => {
    if (!option) {
      return;
    }

    // Preserve any aggregate entries (FUNCTION kind) in state.fields,
    // and update only the X-axis field entry.
    const aggregates =
      state.fields?.filter(f => f.kind === FieldValueKind.FUNCTION) ?? [];

    const newXAxisField = {
      kind: FieldValueKind.FIELD as const,
      field: String(option.value),
    };

    // For categorical bars, state.fields = [X-axis field, ...aggregates]
    dispatch({
      type: BuilderStateAction.SET_FIELDS,
      payload: [newXAxisField, ...aggregates],
    });
  };

  return (
    <Fragment>
      <SectionHeader
        title={t('X-Axis')}
        tooltipText={t(
          'Select the field to use for X-axis categories (e.g., browser, country)'
        )}
      />
      <StyledFieldGroup inline={false} flexibleControlStateSize>
        <StyledCompactSelect
          searchable
          value={currentXAxisField}
          options={fieldOptions}
          onChange={handleXAxisChange}
        />
      </StyledFieldGroup>
    </Fragment>
  );
}

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0;
`;

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  > button {
    width: 100%;
  }
`;
