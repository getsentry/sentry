import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import pick from 'lodash/pick';
import set from 'lodash/set';

import {validateWidget} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import WidgetQueryFields from 'app/components/dashboards/widgetQueryFields';
import SelectControl from 'app/components/forms/selectControl';
import * as Layout from 'app/components/layouts/thirds';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'app/types';
import Measurements from 'app/utils/measurements/measurements';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withTags from 'app/utils/withTags';
import AsyncView from 'app/views/asyncView';
import {
  DashboardDetails,
  DisplayType,
  Widget,
  WidgetQuery,
} from 'app/views/dashboardsV2/types';
import WidgetCard from 'app/views/dashboardsV2/widgetCard';
import {generateFieldOptions} from 'app/views/eventsV2/utils';

import {DEFAULT_STATS_PERIOD} from '../../data';
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

type Props = AsyncView['props'] & {
  organization: Organization;
  onChangeDataSet: (dataSet: DataSet) => void;
  selection: GlobalSelection;
  tags: TagCollection;
  dashboard: DashboardDetails;
  onSave: (widgets: Widget[]) => void;
  widget?: Widget;
};

type State = AsyncView['state'] & {
  title: string;
  displayType: DisplayType;
  interval: string;
  queries: Widget['queries'];
  widgetErrors?: Record<string, any>;
};

class EventWidget extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      title: t('Custom %s Widget', DisplayType.AREA),
      displayType: DisplayType.AREA,
      interval: '5m',
      queries: [{...newQuery}],
    };
  }

  getFirstQueryError(key: string) {
    const {widgetErrors} = this.state;

    if (!widgetErrors) {
      return undefined;
    }

    return widgetErrors.find(queryError => !!queryError?.[key]);
  }

  handleFieldChange = <F extends keyof State>(field: F, value: State[F]) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, field, value);

      if (field === 'displayType') {
        set(newState, 'queries', normalizeQueries(value as DisplayType, state.queries));
      }

      return {...newState, widgetErrors: undefined};
    });
  };

  handleRemoveQuery = (index: number) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      newState.queries.splice(index, index + 1);
      return {...newState, widgetErrors: undefined};
    });
  };

  handleAddQuery = () => {
    this.setState(state => {
      const newState = cloneDeep(state);
      newState.queries.push(cloneDeep(newQuery));
      return newState;
    });
  };

  handleChangeQuery = (index: number, query: WidgetQuery) => {
    this.setState(state => {
      const newState = cloneDeep(state);
      set(newState, `queries.${index}`, query);
      return {...newState, widgetErrors: undefined};
    });
  };

  handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const {organization, onSave, dashboard} = this.props;
    this.setState({loading: true});
    try {
      const widgetData: Widget = pick(this.state, [
        'title',
        'displayType',
        'interval',
        'queries',
      ]);

      await validateWidget(this.api, organization.slug, widgetData);

      onSave([...dashboard.widgets, widgetData]);
      addSuccessMessage(t('Added widget.'));
    } catch (err) {
      const widgetErrors = mapErrors(err?.responseJSON ?? {}, {});
      this.setState({widgetErrors});
    } finally {
      this.setState({loading: false});
    }
  };

  renderBody() {
    const {organization, onChangeDataSet, selection, tags} = this.props;
    const {title, displayType, queries, interval, widgetErrors} = this.state;
    const orgSlug = organization.slug;

    function fieldOptions(measurementKeys: string[]) {
      return generateFieldOptions({
        organization,
        tagKeys: Object.values(tags).map(({key}) => key),
        measurementKeys,
      });
    }

    return (
      <GlobalSelectionHeader
        skipLoadLastUsed={organization.features.includes('global-views')}
        defaultSelection={{
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: DEFAULT_STATS_PERIOD,
          },
        }}
      >
        <StyledPageContent>
          <Header
            orgSlug={orgSlug}
            title={title}
            onChangeTitle={newTitle => this.handleFieldChange('title', newTitle)}
            onSave={this.handleSave}
          />
          <Layout.Body>
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
                      this.handleFieldChange('displayType', option.value);
                    }}
                    error={widgetErrors?.displayType}
                  />
                  <WidgetCard
                    api={this.api}
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
              <ChooseDataSetStep value={DataSet.EVENTS} onChange={onChangeDataSet} />
              <BuildStep
                title={t('Begin your search')}
                description={t('Add another query to compare projects, tags, etc.')}
              >
                <Queries
                  queries={queries}
                  selectedProjectIds={selection.projects}
                  organization={organization}
                  displayType={displayType}
                  onRemoveQuery={this.handleRemoveQuery}
                  onAddQuery={this.handleAddQuery}
                  onChangeQuery={this.handleChangeQuery}
                  errors={widgetErrors?.queries}
                />
              </BuildStep>
              <Measurements>
                {({measurements}) => {
                  const measurementKeys = Object.values(measurements).map(({key}) => key);
                  const amendedFieldOptions = fieldOptions(measurementKeys);
                  const buildStepContent = (
                    <WidgetQueryFields
                      style={{padding: 0}}
                      errors={this.getFirstQueryError('fields')}
                      displayType={displayType}
                      fieldOptions={amendedFieldOptions}
                      fields={queries[0].fields}
                      onChange={fields => {
                        queries.forEach((query, queryIndex) => {
                          const clonedQuery = cloneDeep(query);
                          clonedQuery.fields = fields;
                          this.handleChangeQuery(queryIndex, clonedQuery);
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
          </Layout.Body>
        </StyledPageContent>
      </GlobalSelectionHeader>
    );
  }
}

export default withOrganization(withGlobalSelection(withTags(EventWidget)));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const VisualizationWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
