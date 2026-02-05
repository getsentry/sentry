import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';

export function WidgetBuilderXAxisSelector() {
  const organization = useOrganization();

  const {state, dispatch} = useWidgetBuilderContext();
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();

  const tags: TagCollection = useTags();

  // Only use string tags for categorical X-axis (numeric values don't make good
  // categories). This has a major caveat that _some_ numerical tags like HTTP
  // response status _are_ good for grouping, so we may want to allow that.
  const {tags: stringSpanTags, isLoading: isLoadingSpanTags} = useTraceItemTags('string');

  const datasetConfig = getDatasetConfig(state.dataset);

  // Determine if we're loading tags for EAP datasets
  const isEAPDataset =
    state.dataset === WidgetType.SPANS ||
    state.dataset === WidgetType.LOGS ||
    state.dataset === WidgetType.TRACEMETRICS;

  const isLoading = isEAPDataset && isLoadingSpanTags;

  const fieldOptions = useMemo(() => {
    // For EAP, use the EAP-style tags and format them directly, we've already
    // narrowed down to just string tags
    if (isEAPDataset) {
      return Object.values(stringSpanTags).map(tag => ({
        label: prettifyTagKey(tag.name),
        value: tag.key,
        trailingItems: () => <TypeBadge kind={FieldKind.FIELD} />,
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

          return option.value.meta.dataType === 'string';
        })
        .map(option => ({
          label: option.value.meta.name,
          value: option.value.meta.name,
          trailingItems: () => <TypeBadge kind={FieldKind.FIELD} />,
        }));
    }

    return [];
  }, [isEAPDataset, datasetConfig, organization, tags, stringSpanTags]);

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

    dispatch({
      type: BuilderStateAction.SET_CATEGORICAL_X_AXIS,
      payload: String(option.value),
    });

    trackAnalytics('dashboards_views.widget_builder.change', {
      builder_version: WidgetBuilderVersion.SLIDEOUT,
      field: 'xAxis',
      from: source,
      new_widget: !isEditing,
      value: '',
      widget_type: state.dataset ?? '',
      organization,
    });
  };

  return (
    <Fragment>
      <SectionHeader
        title={t('X-Axis')}
        tooltipText={t('Select the field to use for X-axis categories.')}
      />
      <FullWidthCompactSelect
        searchable
        loading={isLoading}
        value={currentXAxisField}
        options={fieldOptions}
        onChange={handleXAxisChange}
      />
    </Fragment>
  );
}

// This is not currently possible with `Container` trickery or props on
// `CompactSelect`, though it may be coming soon
const FullWidthCompactSelect = styled(CompactSelect)`
  width: 100%;

  > button {
    width: 100%;
  }
`;
