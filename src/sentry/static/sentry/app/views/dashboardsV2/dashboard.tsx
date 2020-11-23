import React from 'react';
import styled from '@emotion/styled';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import {IconAdd} from 'app/icons';
import space from 'app/styles/space';
import {Organization} from 'app/types';

import {DashboardListItem, Widget} from './types';
import WidgetCard from './widgetCard';

type Props = {
  organization: Organization;
  dashboard: DashboardListItem;
  isEditing: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
};

type State = {};

class Dashboard extends React.Component<Props, State> {
  handleStartAdd = () => {
    const {organization, dashboard} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      onAddWidget: this.handleAddComplete,
    });
  };

  handleAddComplete = (widget: Widget) => {
    this.props.onUpdate([...this.props.dashboard.widgets, widget]);
  };

  renderWidget(widget: Widget, i: number) {
    // TODO add drag state and drag re-sorting.
    return (
      <WidgetWrapper key={`${widget.id}:${i}`}>
        <WidgetCard widget={widget} />
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
              <IconAdd size="xl" isCircled color="inactive" />
            </AddWidgetWrapper>
          </WidgetWrapper>
        )}
      </WidgetContainer>
    );
  }
}

export default Dashboard;

const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: ${space(2)};
  grid-auto-flow: row;
`;

const WidgetWrapper = styled('div')`
  position: relative;
`;

const AddWidgetWrapper = styled('a')`
  width: 100%;
  height: 120px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
`;
