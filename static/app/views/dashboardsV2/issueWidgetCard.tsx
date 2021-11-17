import * as React from 'react';
import LazyLoad from 'react-lazyload';
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import ErrorPanel from 'app/components/charts/errorPanel';
import SimpleTableChart from 'app/components/charts/simpleTableChart';
import {HeaderTitle} from 'app/components/charts/styles';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingIndicator from 'app/components/loadingIndicator';
import {isSelectionEqual} from 'app/components/organizations/globalSelectionHeader/utils';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Group, Organization} from 'app/types';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import {ColumnType} from 'app/utils/discover/fields';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import IssueWidgetQueries from './issueWidgetQueries';
import {Widget} from './types';
import WidgetQueries from './widgetQueries';

const ISSUE_TABLE_FIELDS_META: Record<string, ColumnType> = {
  'issue #': 'string',
  title: 'string',
  assignee: 'string',
};

type TableResultProps = Pick<WidgetQueries['state'], 'errorMessage' | 'loading'> & {
  tableResults: Group[];
};

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
  isEditing: boolean;
  widget: Widget;
  selection: GlobalSelection;
  onDelete: () => void;
  onEdit: () => void;
  isSorting: boolean;
  currentWidgetDragging: boolean;
  showContextMenu?: boolean;
  draggableProps?: DraggableProps;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

class IssueWidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    if (
      !isEqual(nextProps.widget, this.props.widget) ||
      !isSelectionEqual(nextProps.selection, this.props.selection) ||
      this.props.isEditing !== nextProps.isEditing ||
      this.props.isSorting !== nextProps.isSorting
    ) {
      return true;
    }
    return false;
  }

  transformTableResults(tableResults: Group[]): TableDataRow[] {
    return tableResults.map(({id, shortId, title, assignedTo}) => {
      const transformedTableResults = {
        id,
        'issue #': shortId,
        title,
        assignee: assignedTo?.name ?? '',
      };
      return transformedTableResults;
    });
  }

  tableResultComponent({
    loading,
    errorMessage,
    tableResults,
  }: TableResultProps): React.ReactNode {
    const {location, organization} = this.props;
    if (errorMessage) {
      return (
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    if (loading) {
      // Align height to other charts.
      return <Placeholder height="200px" />;
    }
    const transformedTableResults = this.transformTableResults(tableResults);

    return (
      <StyledSimpleTableChart
        location={location}
        title=""
        fields={Object.keys(ISSUE_TABLE_FIELDS_META)}
        loading={loading}
        metadata={ISSUE_TABLE_FIELDS_META}
        data={transformedTableResults}
        organization={organization}
      />
    );
  }

  render() {
    const {widget, api, organization, selection, renderErrorMessage} = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={false}>
          <WidgetHeader>
            <WidgetTitle>{widget.title}</WidgetTitle>
          </WidgetHeader>
          <LazyLoad once height={200}>
            <IssueWidgetQueries
              api={api}
              organization={organization}
              widget={widget}
              selection={selection}
            >
              {({tableResults, errorMessage, loading}) => {
                return (
                  <React.Fragment>
                    {typeof renderErrorMessage === 'function'
                      ? renderErrorMessage(errorMessage)
                      : null}
                    <LoadingScreen loading={loading} />
                    {tableResults &&
                      this.tableResultComponent({tableResults, loading, errorMessage})}
                  </React.Fragment>
                );
              }}
            </IssueWidgetQueries>
          </LazyLoad>
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(
  withOrganization(withGlobalSelection(withRouter(IssueWidgetCard)))
);

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingScreen = ({loading}: {loading: boolean}) => {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
};
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
  min-height: 96px;
`;

const WidgetTitle = styled(HeaderTitle)`
  ${overflowEllipsis};
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;
