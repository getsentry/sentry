import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {useValidateWidgetQuery} from 'sentry/views/dashboards/hooks/useValidateWidget';
import {WidgetType} from 'sentry/views/dashboards/types';
import {GroupBySelector} from 'sentry/views/dashboards/widgetBuilder/buildSteps/groupByStep/groupBySelector';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

function WidgetBuilderGroupBySelector() {
  const {state, dispatch} = useWidgetBuilderContext();

  const organization = useOrganization();

  let tags: TagCollection = useTags();
  const numericSpanTags = useSpanTags('number');
  const stringSpanTags = useSpanTags('string');
  if (state.dataset === WidgetType.SPANS) {
    tags = {...numericSpanTags, ...stringSpanTags};
  }

  const widget = convertBuilderStateToWidget(state);

  const validatedWidgetResponse = useValidateWidgetQuery(widget);

  const datasetConfig = getDatasetConfig(state.dataset);
  const groupByOptions = datasetConfig.getGroupByFieldOptions
    ? datasetConfig.getGroupByFieldOptions(organization, tags)
    : {};

  const handleGroupByChange = (newValue: QueryFieldValue[]) => {
    dispatch({
      type: BuilderStateAction.SET_FIELDS,
      payload: newValue,
    });
  };

  return (
    <Fragment>
      <HeaderWrapper>
        <Tooltip
          title={t(
            'Aggregated data by a key attribute to calculate averages, percentiles, count and more'
          )}
          position="right"
          delay={200}
          isHoverable
          showUnderline
        >
          <Header>{t('Group by')}</Header>
        </Tooltip>
        <OptionalHeader>{t('(optional)')}</OptionalHeader>
      </HeaderWrapper>

      <GroupBySelector
        columns={state.fields}
        fieldOptions={groupByOptions}
        onChange={handleGroupByChange}
        validatedWidgetResponse={validatedWidgetResponse}
        style={{paddingRight: 0}}
      />
    </Fragment>
  );
}

export default WidgetBuilderGroupBySelector;

const Header = styled('h6')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
`;

const OptionalHeader = styled('h6')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
`;
