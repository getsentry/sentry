import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import set from 'lodash/set';

import {validateWidget} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import WidgetQueryFields from 'app/components/dashboards/widgetQueryFields';
import SelectControl from 'app/components/forms/selectControl';
import * as Layout from 'app/components/layouts/thirds';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'app/types';
import {defined} from 'app/utils';
import Measurements from 'app/utils/measurements/measurements';
import useApi from 'app/utils/useApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTags from 'app/utils/withTags';
import WidgetCard from 'app/views/dashboardsV2/widgetCard';
import {generateFieldOptions} from 'app/views/eventsV2/utils';

import {DashboardDetails, DisplayType, Widget, WidgetQuery} from '../../types';
import BuildStep from '../buildStep';
import BuildSteps from '../buildSteps';
import ChooseDataSetStep from '../choseDataStep';
import Header from '../header';
import {DataSet, displayTypes} from '../utils';

import Queries from './queries';
import {mapErrors, normalizeQueries} from './utils';

const newQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
  orderby: '',
};

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  dashboardTitle: DashboardDetails['title'];
  tags: TagCollection;
  isEditing: boolean;
  goBackLocation: LocationDescriptor;
  hasMetricsFeatureFlag: boolean;
  onChangeDataSet: (dataSet: DataSet) => void;
  onAdd: (widget: Widget) => void;
  onUpdate: (nextWidget: Widget) => void;
  onDelete: () => void;
  widget?: Widget;
};

type State = {
  title: string;
  displayType: DisplayType;
  interval: string;
  queries: Widget['queries'];
  isSaving: boolean;
  widgetErrors?: Record<string, any>;
};

function EventWidget({
  organization,
  onChangeDataSet,
  selection,
  tags,
  isEditing,
  goBackLocation,
  dashboardTitle,
  onDelete,
  hasMetricsFeatureFlag,
  widget,
  onAdd,
  onUpdate,
}: Props) {
  const [state, setState] = useState<State>(getInitialState());
  const api = useApi();

  const {title, displayType, queries, interval, widgetErrors, isSaving} = state;

  useEffect(() => {
    if (isSaving) {
      submitWidget();
    }
  }, [isSaving]);

  function getInitialState() {
    if (!widget) {
      return {
        title: t('Custom %s Widget', displayTypes[DisplayType.AREA]),
        displayType: DisplayType.AREA,
        interval: '5m',
        queries: [{...newQuery}],
        isSaving: false,
      };
    }

    return {
      title: widget.title,
      displayType: widget.displayType,
      interval: widget.interval,
      queries: normalizeQueries(widget.displayType, widget.queries),
      widgetErrors: undefined,
      isSaving: false,
    };
  }

  function getFirstQueryError(field: string) {
    if (!widgetErrors) {
      return undefined;
    }

    const [key, value] =
      Object.entries(widgetErrors).find(
        (widgetErrorKey, _) => String(widgetErrorKey) === field
      ) ?? [];

    if (defined(key) && defined(value)) {
      return {[key]: value};
    }

    return undefined;
  }

  function handleFieldChange<F extends keyof State>(field: F, value: State[F]) {
    const newState = cloneDeep(state);

    if (field === 'displayType') {
      set(newState, 'queries', normalizeQueries(value as DisplayType, state.queries));
      if (
        state.title === t('Custom %s Widget', state.displayType) ||
        state.title === t('Custom %s Widget', DisplayType.AREA)
      ) {
        setState({
          ...newState,
          title: t('Custom %s Widget', displayTypes[value as DisplayType]),
          widgetErrors: undefined,
        });
      }

      set(newState, field, value);
    }

    return setState({...newState, widgetErrors: undefined});
  }

  function handleRemoveQuery(index: number) {
    const newState = cloneDeep(state);
    newState.queries.splice(index, 1);
    setState({...newState, widgetErrors: undefined});
  }

  function handleAddQuery() {
    const newState = cloneDeep(state);
    newState.queries.push(cloneDeep(newQuery));
    setState(newState);
  }

  function handleChangeQuery(index: number, query: WidgetQuery) {
    const newState = cloneDeep(state);
    set(newState, `queries.${index}`, query);
    setState({...state, widgetErrors: undefined});
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setState({...state, isSaving: true});
  }

  async function submitWidget() {
    try {
      const widgetData: Widget = pick(state, [
        'title',
        'displayType',
        'interval',
        'queries',
      ]);

      await validateWidget(api, organization.slug, widgetData);

      if (isEditing) {
        (onUpdate as (nextWidget: Widget) => void)({
          id: (widget as Widget).id,
          ...widgetData,
        });
        addSuccessMessage(t('Updated widget'));
        return;
      }

      onAdd(widgetData);
      addSuccessMessage(t('Added widget'));
    } catch (err) {
      setState({
        ...state,
        widgetErrors: mapErrors(err?.responseJSON ?? {}, {}),
        isSaving: false,
      });
    }
  }

  const orgSlug = organization.slug;

  function fieldOptions(measurementKeys: string[]) {
    return generateFieldOptions({
      organization,
      tagKeys: Object.values(tags).map(({key}) => key),
      measurementKeys,
    });
  }

  return (
    <StyledPageContent>
      <Header
        dashboardTitle={dashboardTitle}
        orgSlug={orgSlug}
        title={title}
        isDisabled={isSaving}
        isEditing={isEditing}
        onChangeTitle={newTitle => handleFieldChange('title', newTitle)}
        onSave={handleSave}
        onDelete={onDelete}
        goBackLocation={goBackLocation}
      />
      <Layout.Body>
        {isSaving ? (
          <LoadingIndicator />
        ) : (
          <BuildSteps>
            <BuildStep
              title={t('Choose your visualization')}
              description={t(
                'This is a preview of how your widget will appear in the dashboard.'
              )}
            >
              <VisualizationWrapper>
                <SelectControl
                  name="displayType"
                  options={Object.keys(displayTypes).map(value => ({
                    label: displayTypes[value],
                    value,
                  }))}
                  value={displayType}
                  onChange={(option: {label: string; value: DisplayType}) => {
                    handleFieldChange('displayType', option.value);
                  }}
                  error={widgetErrors?.displayType}
                />
                <WidgetCard
                  api={api}
                  organization={organization}
                  selection={selection}
                  widget={{title, queries, displayType, interval}}
                  isEditing={false}
                  onDelete={() => undefined}
                  onEdit={() => undefined}
                  renderErrorMessage={errorMessage =>
                    typeof errorMessage === 'string' && (
                      <PanelAlert type="error">{errorMessage}</PanelAlert>
                    )
                  }
                  isSorting={false}
                  currentWidgetDragging={false}
                />
              </VisualizationWrapper>
            </BuildStep>
            {hasMetricsFeatureFlag && (
              <ChooseDataSetStep value={DataSet.EVENTS} onChange={onChangeDataSet} />
            )}
            <BuildStep
              title={t('Begin your search')}
              description={t('Add another query to compare projects, tags, etc.')}
            >
              <Queries
                queries={queries}
                selectedProjectIds={selection.projects}
                organization={organization}
                displayType={displayType}
                onRemoveQuery={handleRemoveQuery}
                onAddQuery={handleAddQuery}
                onChangeQuery={handleChangeQuery}
                errors={widgetErrors?.queries}
              />
            </BuildStep>
            <Measurements organization={organization}>
              {({measurements}) => {
                const measurementKeys = Object.values(measurements).map(({key}) => key);
                const amendedFieldOptions = fieldOptions(measurementKeys);
                const buildStepContent = (
                  <WidgetQueryFields
                    style={{padding: 0}}
                    errors={getFirstQueryError('fields')}
                    displayType={displayType}
                    fieldOptions={amendedFieldOptions}
                    fields={queries[0].fields}
                    organization={organization}
                    onChange={fields => {
                      queries.forEach((query, queryIndex) => {
                        const clonedQuery = cloneDeep(query);
                        clonedQuery.fields = fields;
                        handleChangeQuery(queryIndex, clonedQuery);
                      });
                    }}
                  />
                );
                return (
                  <BuildStep
                    title={
                      displayType === DisplayType.TABLE
                        ? t('Choose your columns')
                        : t('Choose your y-axis')
                    }
                    description={t(
                      'We’ll use this to determine what gets graphed in the y-axis and any additional overlays.'
                    )}
                  >
                    {buildStepContent}
                  </BuildStep>
                );
              }}
            </Measurements>
          </BuildSteps>
        )}
      </Layout.Body>
    </StyledPageContent>
  );
}

export default withGlobalSelection(withTags(EventWidget));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
