import React from 'react';
import styled from '@emotion/styled';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import {IconAdd} from 'app/icons';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {DashboardDetails, Widget} from './types';
import WidgetCard from './widgetCard';

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: GlobalSelection;
  isEditing: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
};

type State = {};

class Dashboard extends React.Component<Props, State> {
  componentDidMount() {
    const {isEditing} = this.props;
    // Load organization tags when in edit mode.
    if (isEditing) {
      this.fetchTags();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {isEditing} = this.props;

    // Load organization tags when going into edit mode.
    // We use tags on the add widget modal.
    if (prevProps.isEditing !== isEditing && isEditing) {
      this.fetchTags();
    }
  }

  fetchTags() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
  }

  handleStartAdd = () => {
    const {organization, dashboard, selection} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      selection,
      onAddWidget: this.handleAddComplete,
    });
  };

  handleAddComplete = (widget: Widget) => {
    this.props.onUpdate([...this.props.dashboard.widgets, widget]);
  };

  handleUpdateComplete = (index: number) => (nextWidget: Widget) => {
    const nextList = [...this.props.dashboard.widgets];
    nextList[index] = nextWidget;
    this.props.onUpdate(nextList);
  };

  handleDeleteWidget = (index: number) => () => {
    const nextList = [...this.props.dashboard.widgets];
    nextList.splice(index, 1);
    this.props.onUpdate(nextList);
  };

  handleEditWidget = (widget: Widget, index: number) => () => {
    const {organization, dashboard, selection} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      widget,
      selection,
      onAddWidget: this.handleAddComplete,
      onUpdateWidget: this.handleUpdateComplete(index),
    });
  };

  renderWidget(widget: Widget, index: number) {
    const {isEditing} = this.props;
    // TODO add drag state and drag re-sorting.
    return (
      <WidgetWrapper key={`${widget.id}:${index}`}>
        <WidgetCard
          widget={widget}
          isEditing={isEditing}
          onDelete={this.handleDeleteWidget(index)}
          onEdit={this.handleEditWidget(widget, index)}
        />
      </WidgetWrapper>
    );
  }

  render() {
    const {isEditing, dashboard} = this.props;

    return (
      <WidgetContainer>
        {dashboard.widgets.map((widget, i) => this.renderWidget(widget, i))}
        {isEditing && (
          <WidgetWrapper key="add">
            <AddWidgetWrapper key="add" onClick={this.handleStartAdd}>
              <IconAdd size="lg" isCircled color="inactive" />
            </AddWidgetWrapper>
          </WidgetWrapper>
        )}
      </WidgetContainer>
    );
  }
}

export default withApi(withGlobalSelection(Dashboard));

const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr;
  }
`;

const WidgetWrapper = styled('div')`
  position: relative;
`;

const AddWidgetWrapper = styled('a')`
  width: 100%;
  height: 100%;
  min-height: 200px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
`;
