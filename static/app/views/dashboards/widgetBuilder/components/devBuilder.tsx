import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
import Input from 'sentry/components/input';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {space} from 'sentry/styles/space';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import {type Column, generateFieldAsString} from 'sentry/utils/discover/fields';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {ColumnFields} from 'sentry/views/dashboards/widgetBuilder/buildSteps/columnsStep/columnFields';
import {YAxisSelector} from 'sentry/views/dashboards/widgetBuilder/buildSteps/yAxisStep/yAxisSelector';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

function DevBuilder() {
  const {state, dispatch} = useWidgetBuilderContext();
  const [showDevBuilder] = useLocalStorageState('showDevBuilder', false);

  if (!showDevBuilder) {
    return null;
  }

  return (
    <Body>
      <Section>
        <h1>Title:</h1>
        <div style={{flex: 1}}>{state.title}</div>
        <SimpleInput
          value={state.title}
          onChange={e =>
            dispatch({type: BuilderStateAction.SET_TITLE, payload: e.target.value})
          }
        />
      </Section>
      <Section>
        <h1>Description:</h1>
        <div style={{flex: 1}}>{state.description}</div>
        <SimpleInput
          value={state.description}
          onChange={e =>
            dispatch({
              type: BuilderStateAction.SET_DESCRIPTION,
              payload: e.target.value,
            })
          }
        />
      </Section>
      <Section>
        <h1>Display Type:</h1>
        <div style={{flex: 1}}>{state.displayType}</div>
        <SelectField
          name="displayType"
          value={state.displayType}
          options={Object.values(DisplayType).map(value => ({
            label: value,
            value,
          }))}
          onChange={newValue =>
            dispatch({
              type: BuilderStateAction.SET_DISPLAY_TYPE,
              payload: newValue,
            })
          }
          style={{width: '200px'}}
        />
      </Section>
      <Section>
        <h1>Dataset:</h1>
        <div>{state.dataset}</div>
        <RadioGroup
          label="Dataset"
          value={state.dataset ?? null}
          choices={[
            [WidgetType.DISCOVER, 'Discover'],
            [WidgetType.ISSUE, 'Issue'],
            [WidgetType.RELEASE, 'Release'],
            [WidgetType.METRICS, 'Metrics'],
            [WidgetType.ERRORS, 'Errors'],
            [WidgetType.TRANSACTIONS, 'Transactions'],
          ]}
          onChange={newValue =>
            dispatch({
              type: BuilderStateAction.SET_DATASET,
              payload: newValue,
            })
          }
        />
      </Section>
      <Section>
        <h1>Fields:</h1>
        <div>{state.fields?.map(generateFieldAsString).join(', ')}</div>
        <ColumnSelector
          displayType={state.displayType ?? DisplayType.TABLE}
          dataset={state.dataset ?? WidgetType.DISCOVER}
          fields={state.fields ?? [{field: '', kind: 'field'}]}
          onChange={newFields => {
            dispatch({
              type: BuilderStateAction.SET_FIELDS,
              payload: newFields,
            });
          }}
        />
      </Section>
      <Section>
        <h1>Y-Axis:</h1>
        <div>{state.yAxis?.map(generateFieldAsString).join(', ')}</div>
        <YAxis
          displayType={state.displayType ?? DisplayType.TABLE}
          widgetType={state.dataset ?? WidgetType.DISCOVER}
          aggregates={state.yAxis ?? [{field: '', kind: 'field'}]}
          onChange={newAggregates => {
            dispatch({
              type: BuilderStateAction.SET_Y_AXIS,
              payload: newAggregates,
            });
          }}
        />
      </Section>
      <Section>
        <h1>Query:</h1>
        <ol style={{overflow: 'auto'}}>
          {state.query?.map((query, index) => <li key={index}>{query}</li>)}
        </ol>
        <div>
          {state.query?.map((query, index) => (
            <div key={index} style={{display: 'flex', flexDirection: 'row'}}>
              <QueryField
                query={query}
                onSearch={queryString => {
                  dispatch({
                    type: BuilderStateAction.SET_QUERY,
                    payload:
                      state.query?.map((q, i) => (i === index ? queryString : q)) ?? [],
                  });
                }}
              />
              <button
                onClick={() =>
                  dispatch({
                    type: BuilderStateAction.SET_QUERY,
                    payload: state.query?.filter((_, i) => i !== index) ?? [],
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              dispatch({
                type: BuilderStateAction.SET_QUERY,
                payload: [...(state.query ?? []), ''],
              })
            }
          >
            Add
          </button>
        </div>
      </Section>
    </Body>
  );
}

function ColumnSelector({
  displayType,
  fields,
  dataset,
  onChange,
}: {
  dataset: WidgetType;
  displayType: DisplayType;
  fields: Column[];
  onChange: (newFields: Column[]) => void;
}) {
  const organization = useOrganization();
  const datasetConfig = getDatasetConfig(dataset);

  const fieldOptions = datasetConfig.getTableFieldOptions(organization);

  return (
    <ColumnFields
      displayType={displayType ?? DisplayType.TABLE}
      organization={organization}
      widgetType={dataset ?? WidgetType.DISCOVER}
      fields={fields ?? []}
      errors={[]}
      fieldOptions={fieldOptions}
      isOnDemandWidget={false}
      filterAggregateParameters={() => true}
      filterPrimaryOptions={() => true}
      onChange={onChange}
    />
  );
}

function YAxis({
  displayType,
  widgetType,
  aggregates,
  onChange,
}: {
  aggregates: Column[];
  displayType: DisplayType;
  onChange: (newFields: Column[]) => void;
  widgetType: WidgetType;
}) {
  const organization = useOrganization();
  return (
    <CustomMeasurementsProvider organization={organization}>
      <YAxisSelector
        widgetType={widgetType}
        displayType={displayType}
        aggregates={aggregates}
        onChange={onChange}
        tags={{}}
        errors={[]}
        selectedAggregate={undefined}
      />
    </CustomMeasurementsProvider>
  );
}

function QueryField({
  query,
  onSearch,
}: {
  onSearch: (query: string) => void;
  query: string;
}) {
  return (
    <SearchQueryBuilder
      placeholder={'Search'}
      filterKeys={{}}
      initialQuery={query ?? ''}
      onSearch={onSearch}
      searchSource={'widget_builder'}
      filterKeySections={[]}
      getTagValues={() => Promise.resolve([])}
      showUnsubmittedIndicator
    />
  );
}

const Body = styled('div')`
  margin: ${space(2)};
  padding: ${space(2)};
`;

const Section = styled('section')`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  border: 1px solid ${p => p.theme.border};
  align-items: center;

  > * {
    flex: 1;
  }
`;

const SimpleInput = styled(Input)`
  width: 100%;
`;

export default DevBuilder;
