import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import ErrorBoundary from 'app/components/errorBoundary';
import {isSelectionEqual} from 'app/components/organizations/globalSelectionHeader/utils';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconDelete, IconEdit, IconGrabbable} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {HeaderTitle} from '../performance/styles';

import {Widget} from './types';
import WidgetCardChart from './widgetCardChart';
import WidgetQueries from './widgetQueries';

type Props = ReactRouter.WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
  isEditing: boolean;
  widget: Widget;
  selection: GlobalSelection;
  onDelete: () => void;
  onEdit: () => void;
  renderErrorMessage?: (errorMessage: string | undefined) => React.ReactNode;
  isDragging: boolean;
  hideToolbar?: boolean;
  startWidgetDrag: (
    event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>
  ) => void;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    if (
      !isEqual(nextProps.widget, this.props.widget) ||
      !isSelectionEqual(nextProps.selection, this.props.selection) ||
      this.props.isEditing !== nextProps.isEditing ||
      this.props.isDragging !== nextProps.isDragging ||
      this.props.hideToolbar !== nextProps.hideToolbar
    ) {
      return true;
    }
    return false;
  }

  renderToolbar() {
    if (!this.props.isEditing) {
      return null;
    }

    if (this.props.hideToolbar) {
      return <ToolbarPanel />;
    }

    const {onEdit, onDelete, startWidgetDrag} = this.props;

    return (
      <ToolbarPanel>
        <IconContainer data-component="icon-container">
          <IconClick>
            <StyledIconGrabbable
              color="gray500"
              size="md"
              onMouseDown={event => startWidgetDrag(event)}
              onTouchStart={event => startWidgetDrag(event)}
            />
          </IconClick>
          <IconClick
            data-test-id="widget-edit"
            onClick={() => {
              onEdit();
            }}
          >
            <IconEdit color="gray500" size="md" />
          </IconClick>
          <IconClick
            data-test-id="widget-delete"
            onClick={() => {
              onDelete();
            }}
          >
            <IconDelete color="gray500" size="md" />
          </IconClick>
        </IconContainer>
      </ToolbarPanel>
    );
  }

  render() {
    const {
      widget,
      isDragging,
      api,
      organization,
      selection,
      renderErrorMessage,
      location,
      router,
    } = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <div
          style={{
            backgroundColor: isDragging ? theme.innerBorder : undefined,
            borderRadius: isDragging ? theme.borderRadius : undefined,
          }}
        >
          <StyledPanel isDragging={isDragging}>
            <WidgetTitle>{widget.title}</WidgetTitle>
            <WidgetQueries
              api={api}
              organization={organization}
              widget={widget}
              selection={selection}
            >
              {({tableResults, timeseriesResults, errorMessage, loading}) => {
                return (
                  <React.Fragment>
                    {typeof renderErrorMessage === 'function'
                      ? renderErrorMessage(errorMessage)
                      : null}
                    <WidgetCardChart
                      timeseriesResults={timeseriesResults}
                      tableResults={tableResults}
                      errorMessage={errorMessage}
                      loading={loading}
                      location={location}
                      widget={widget}
                      selection={selection}
                      router={router}
                    />
                    {this.renderToolbar()}
                  </React.Fragment>
                );
              }}
            </WidgetQueries>
          </StyledPanel>
        </div>
      </ErrorBoundary>
    );
  }
}

export default withApi(
  withOrganization(withGlobalSelection(ReactRouter.withRouter(WidgetCard)))
);

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel, {
  shouldForwardProp: prop => prop !== 'isDragging',
})<{
  isDragging: boolean;
}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 110px;
`;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: center;
  align-items: center;

  background-color: rgba(255, 255, 255, 0.5);
`;

const IconContainer = styled('div')`
  display: flex;

  > * + * {
    margin-left: 50px;
  }
`;

const IconClick = styled('div')`
  background: ${p => p.theme.background};
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  line-height: 0.9;

  &:hover {
    cursor: pointer;
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  &:hover {
    cursor: grab;
  }
`;

const WidgetTitle = styled(HeaderTitle)`
  padding: ${space(1)} ${space(2)};
  width: 100%;
`;
