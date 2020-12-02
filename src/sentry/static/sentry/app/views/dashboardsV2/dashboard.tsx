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

import {DashboardListItem, Widget} from './types';
import WidgetCard from './widgetCard';

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardListItem;
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

export default withApi(withGlobalSelection(Dashboard));

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
