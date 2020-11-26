import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'app/types';
import {
  explodeField,
  generateFieldAsString,
  QueryFieldValue,
} from 'app/utils/discover/fields';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withTags from 'app/utils/withTags';
import {DashboardListItem, Widget} from 'app/views/dashboardsV2/types';
import SearchBar from 'app/views/events/searchBar';
import {QueryField} from 'app/views/eventsV2/table/queryField';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

type Props = ModalRenderProps & {
  api: Client;
  organization: Organization;
  dashboard: DashboardListItem;
  selection: GlobalSelection;
  onAddWidget: (data: Widget) => void;
  tags: TagCollection;
};

type State = {
  title: string;
  displayType: Widget['displayType'];
  interval: Widget['interval'];
  queries: Widget['queries'];
};

const DISPLAY_TYPE_CHOICES = [
  {label: t('Area chart'), value: 'area'},
  {label: t('Bar chart'), value: 'bar'},
  {label: t('Line chart'), value: 'line'},
];

const newQuery = {
  name: '',
  fields: ['count()'],
  conditions: '',
};

class AddDashboardWidgetModal extends React.Component<Props, State> {
  state: State = {
    title: '',
    displayType: 'line',
    interval: '5m',
    queries: [{...newQuery}],
  };

  handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const {closeModal, onAddWidget} = this.props;
    onAddWidget(this.state as Widget);
    addSuccessMessage(t('Added widget.'));
    closeModal();
  };

  handleAddField = (queryIndex: number) => (event: React.MouseEvent) => {
    event.preventDefault();

    this.setState(prevState => {
      const queries = cloneDeep(prevState.queries);
      queries[queryIndex].fields.push('');
      return {
        ...prevState,
        queries,
      };
    });
  };

  handleRemoveField = (queryIndex: number, fieldIndex: number) => (
    event: React.MouseEvent
  ) => {
    event.preventDefault();

    this.setState(prevState => {
      const queries = cloneDeep(prevState.queries);
      queries[queryIndex].fields.splice(fieldIndex, fieldIndex + 1);
      return {
        ...prevState,
        queries,
      };
    });
  };

  handleFieldChange = (field: string) => (value: string) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);
      return newState;
    });
  };

  handleQueryField = (queryIndex: number, fieldIndex: number) => (
    value: QueryFieldValue
  ) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(
        newState,
        `queries.${queryIndex}.fields.${fieldIndex}`,
        generateFieldAsString(value)
      );
      return newState;
    });
  };

  render() {
    const {Body, Header, closeModal, organization, selection, tags} = this.props;
    const state = this.state;

    // TODO(mark) Figure out how to get measurement keys here.
    const fieldOptions = generateFieldOptions({
      organization,
      tagKeys: Object.values(tags).map(({key}) => key),
      measurementKeys: [],
    });

    // TODO(mark) Expand query inputs to be more complete.
    // Currently missing is multiple queries and interval input.
    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Add Widget')}
        </Header>
        <Body>
          <form>
            <Panel>
              <PanelHeader>{t('Widget Attributes')}</PanelHeader>
              <PanelBody>
                <TextField
                  name="title"
                  label={t('Title')}
                  required
                  value={state.title}
                  onChange={this.handleFieldChange('title')}
                />
                <SelectField
                  deprecatedSelectControl
                  required
                  options={DISPLAY_TYPE_CHOICES.slice()}
                  name="displayType"
                  label={t('Chart Style')}
                  value={state.displayType}
                  onChange={this.handleFieldChange('displayType')}
                />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>{t('Query')}</PanelHeader>
              <PanelBody>
                <VerticalPanelItem>
                  <SectionHeading>{t('Conditions')}</SectionHeading>
                  <SearchBar
                    organization={organization}
                    projectIds={selection.projects}
                    query={state.queries[0].conditions}
                    fields={[]}
                    onSearch={this.handleFieldChange('queries.0.conditions')}
                    onBlur={this.handleFieldChange('queries.0.conditions')}
                    useFormWrapper={false}
                  />
                </VerticalPanelItem>
                <VerticalPanelItem>
                  <SectionHeading>{t('Fields')}</SectionHeading>
                  {state.queries[0].fields.map((field, i) => (
                    <QueryFieldWrapper key={`${field}:${i}`}>
                      <QueryField
                        fieldValue={explodeField({field})}
                        fieldOptions={fieldOptions}
                        onChange={this.handleQueryField(0, i)}
                      />
                      {state.queries[0].fields.length > 1 && (
                        <Button
                          priority="default"
                          size="zero"
                          borderless
                          onClick={this.handleRemoveField(0, i)}
                          icon={<IconDelete />}
                          title={t('Remove this field')}
                        />
                      )}
                    </QueryFieldWrapper>
                  ))}
                  <div>
                    <Button
                      data-test-id="add-field"
                      priority="default"
                      size="small"
                      onClick={this.handleAddField(0)}
                      icon={<IconAdd />}
                      title={t('Add a field')}
                    />
                  </div>
                </VerticalPanelItem>
              </PanelBody>
            </Panel>
            <FooterButtons>
              <Button
                data-test-id="add-widget"
                priority="primary"
                type="button"
                onClick={this.handleSubmit}
              >
                {t('Add Widget')}
              </Button>
            </FooterButtons>
          </form>
        </Body>
      </React.Fragment>
    );
  }
}

const FooterButtons = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const VerticalPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
`;

export default withApi(withGlobalSelection(withTags(AddDashboardWidgetModal)));
