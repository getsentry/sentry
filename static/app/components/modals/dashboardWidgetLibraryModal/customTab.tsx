import * as React from 'react';
import {components, OptionProps} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import WidgetQueriesForm from 'app/components/dashboards/widgetQueriesForm';
import SelectControl from 'app/components/forms/selectControl';
import PanelAlert from 'app/components/panels/panelAlert';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, SelectValue, TagCollection} from 'app/types';
import Measurements from 'app/utils/measurements/measurements';
import {DISPLAY_TYPE_CHOICES} from 'app/views/dashboardsV2/data';
import {
  DashboardListItem,
  MAX_WIDGETS,
  Widget,
  WidgetQuery,
} from 'app/views/dashboardsV2/types';
import WidgetCard from 'app/views/dashboardsV2/widgetCard';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

type Props = {
  api: Client;
  organization: Organization;
  title: string;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  queries: Widget['queries'];
  tags: TagCollection;
  fromDiscover?: boolean;
  errors?: Record<string, any>;
  querySelection: GlobalSelection;
  loading: boolean;
  handleFieldChange: (field: string) => (value: string) => void;
  handleQueryChange: (widgetQuery: WidgetQuery, index: number) => void;
  handleQueryRemove: (index: number) => void;
  handleAddSearchConditions: () => void;
  handleErrors: (errors: Record<string, any>) => void;
  handleLoading: (loading: boolean) => void;
  handleDashboardChange?: (option: SelectValue<string>) => void;
};

type State = {
  dashboards: DashboardListItem[];
};
class DashboardWidgetBody extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      dashboards: [],
    };
  }

  componentDidMount() {
    const {fromDiscover} = this.props;
    if (fromDiscover) {
      this.fetchDashboards();
    }
  }

  canAddSearchConditions() {
    const {displayType, queries} = this.props;
    const rightDisplayType = ['line', 'area', 'stacked_area', 'bar'].includes(
      displayType
    );
    const underQueryLimit = queries.length < 3;

    return rightDisplayType && underQueryLimit;
  }

  renderDashboardSelector() {
    const {dashboards} = this.state;
    const {errors, loading, handleDashboardChange} = this.props;
    const dashboardOptions = dashboards.map(d => {
      return {
        label: d.title,
        value: d.id,
        isDisabled: d.widgetDisplay.length >= MAX_WIDGETS,
      };
    });
    return (
      <React.Fragment>
        <p>
          {t(
            `Choose which dashboard you'd like to add this query to. It will appear as a widget.`
          )}
        </p>
        <Field
          label={t('Custom Dashboard')}
          inline={false}
          flexibleControlStateSize
          stacked
          error={errors?.dashboard}
          style={{marginBottom: space(1), position: 'relative'}}
          required
        >
          <SelectControl
            name="dashboard"
            options={[
              {label: t('+ Create New Dashboard'), value: 'new'},
              ...dashboardOptions,
            ]}
            onChange={(option: SelectValue<string>) => {
              if (handleDashboardChange) {
                handleDashboardChange(option);
              }
            }}
            disabled={loading}
            components={{
              Option: ({label, data, ...optionProps}: OptionProps<any>) => (
                <Tooltip
                  disabled={!!!data.isDisabled}
                  title={tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                    maxWidgets: MAX_WIDGETS,
                  })}
                  containerDisplayMode="block"
                  position="right"
                >
                  <components.Option
                    label={label}
                    data={data}
                    {...(optionProps as any)}
                  />
                </Tooltip>
              ),
            }}
          />
        </Field>
      </React.Fragment>
    );
  }

  async fetchDashboards() {
    const {api, organization, handleLoading} = this.props;
    const promise: Promise<DashboardListItem[]> = api.requestPromise(
      `/organizations/${organization.slug}/dashboards/`,
      {
        method: 'GET',
        query: {sort: 'myDashboardsAndRecentlyViewed'},
      }
    );

    try {
      const dashboards = await promise;
      this.setState({
        dashboards,
      });
    } catch (error) {
      const errorResponse = error?.responseJSON ?? null;
      if (errorResponse) {
        addErrorMessage(errorResponse);
      } else {
        addErrorMessage(t('Unable to fetch dashboards'));
      }
    }
    handleLoading(false);
  }

  render() {
    const {
      api,
      title,
      displayType,
      queries,
      interval,
      organization,
      tags,
      querySelection,
      fromDiscover,
      handleFieldChange,
      handleQueryChange,
      handleQueryRemove,
      handleAddSearchConditions,
    } = this.props;
    const fieldOptions = (measurementKeys: string[]) =>
      generateFieldOptions({
        organization,
        tagKeys: Object.values(tags).map(({key}) => key),
        measurementKeys,
      });
    const widget = {title, displayType, queries, interval} as Widget;

    return (
      <React.Fragment>
        {fromDiscover && this.renderDashboardSelector()}
        <DoubleFieldWrapper>
          <StyledField
            data-test-id="widget-name"
            label={t('Widget Name')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <Input
              type="text"
              name="title"
              maxLength={255}
              required
              value={title}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                handleFieldChange('title')(event.target.value);
              }}
            />
          </StyledField>
          <StyledField
            data-test-id="chart-type"
            label={t('Visualization Display')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <SelectControl
              options={DISPLAY_TYPE_CHOICES.slice()}
              name="displayType"
              value={displayType}
              onChange={option => {
                handleFieldChange('displayType')(option.value);
              }}
            />
          </StyledField>
        </DoubleFieldWrapper>
        <Measurements organization={organization}>
          {({measurements}) => {
            const measurementKeys = Object.values(measurements).map(({key}) => key);
            const amendedFieldOptions = fieldOptions(measurementKeys);
            return (
              <WidgetQueriesForm
                organization={organization}
                selection={querySelection}
                fieldOptions={amendedFieldOptions}
                displayType={displayType}
                queries={queries}
                onChange={(queryIndex: number, widgetQuery: WidgetQuery) =>
                  handleQueryChange(widgetQuery, queryIndex)
                }
                canAddSearchConditions={this.canAddSearchConditions()}
                handleAddSearchConditions={handleAddSearchConditions}
                handleDeleteQuery={handleQueryRemove}
              />
            );
          }}
        </Measurements>
        <WidgetCard
          api={api}
          organization={organization}
          selection={querySelection}
          widget={widget}
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
      </React.Fragment>
    );
  }
}

const DoubleFieldWrapper = styled('div')`
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  grid-column-gap: ${space(1)};
  width: 100%;
`;

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

const StyledField = styled(Field)`
  position: relative;
`;

export default DashboardWidgetBody;
