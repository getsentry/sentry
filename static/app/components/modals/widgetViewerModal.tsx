import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  getFieldsFromEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
} from 'sentry/views/dashboardsV2/utils';
import WidgetCardChartContainer from 'sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer';
import WidgetQueries from 'sentry/views/dashboardsV2/widgetCard/widgetQueries';

export type WidgetViewerModalOptions = {
  organization: Organization;
  widget: Widget;
  onEdit?: () => void;
};

type Props = ModalRenderProps &
  WithRouterProps &
  WidgetViewerModalOptions & {
    organization: Organization;
    selection: PageFilters;
  };

const TABLE_ITEM_LIMIT = 30;
const FULL_TABLE_HEIGHT = 600;
const HALF_TABLE_HEIGHT = 300;

function WidgetViewerModal(props: Props) {
  const renderWidgetViewer = () => {
    const {organization, selection, widget, location} = props;
    const api = useApi();
    switch (widget.displayType) {
      case DisplayType.TABLE:
        return (
          <TableContainer height={FULL_TABLE_HEIGHT}>
            <WidgetCardChartContainer
              api={api}
              organization={organization}
              selection={selection}
              widget={widget}
              tableItemLimit={TABLE_ITEM_LIMIT}
            />
          </TableContainer>
        );
      default:
    }

    // Create Table widget
    const tableWidget = {...cloneDeep(widget), displayType: DisplayType.TABLE};
    const fields = tableWidget.queries[0].fields;
    // Updates fields by adding any individual terms from equation fields as a column
    const equationFields = getFieldsFromEquations(fields);
    equationFields.forEach(term => {
      if (Array.isArray(fields) && !fields.includes(term)) {
        fields.unshift(term);
      }
    });
    return (
      <React.Fragment>
        <Container>
          <WidgetCardChartContainer
            api={api}
            organization={organization}
            selection={selection}
            widget={widget}
          />
        </Container>
        <TableContainer height={HALF_TABLE_HEIGHT}>
          <WidgetQueries
            api={api}
            organization={organization}
            widget={tableWidget}
            selection={selection}
            limit={TABLE_ITEM_LIMIT}
          >
            {({tableResults, loading}) => {
              return (
                <StyledSimpleTableChart
                  location={location}
                  title=""
                  fields={tableWidget.queries[0].fields}
                  loading={loading}
                  metadata={tableResults?.[0]?.meta}
                  data={tableResults?.[0]?.data}
                  organization={organization}
                  topResultsIndicators={
                    widget.displayType === DisplayType.TOP_N ? 5 : undefined
                  }
                  stickyHeaders
                />
              );
            }}
          </WidgetQueries>
        </TableContainer>
      </React.Fragment>
    );
  };

  const {Footer, Body, Header, widget, onEdit, selection, organization} = props;

  const StyledHeader = styled(Header)`
    ${headerCss}
  `;
  const StyledFooter = styled(Footer)`
    ${footerCss}
  `;

  let openLabel: string;
  let path: string;
  switch (widget.widgetType) {
    case WidgetType.ISSUE:
      openLabel = t('Open in Issues');
      path = getWidgetIssueUrl(widget, selection, organization);
      break;
    case WidgetType.DISCOVER:
    default:
      openLabel = t('Open in Discover');
      path = getWidgetDiscoverUrl(widget, selection, organization);
      break;
  }
  return (
    <React.Fragment>
      <StyledHeader closeButton>
        <h4>{widget.title}</h4>
      </StyledHeader>
      <Body>{renderWidgetViewer()}</Body>
      <StyledFooter>
        <ButtonBar gap={1}>
          <Button type="button" onClick={onEdit}>
            {t('Edit Widget')}
          </Button>
          <Button to={path} priority="primary" type="button">
            {openLabel}
          </Button>
        </ButtonBar>
      </StyledFooter>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1400px;
  margin: 70px auto;
`;

const headerCss = css`
  margin: -${space(4)} -${space(4)} 0px -${space(4)};
`;
const footerCss = css`
  margin: 0px -${space(4)} -${space(4)};
`;

const Container = styled('div')`
  height: 300px;
  max-height: 300px;
  position: relative;

  & > div {
    padding: 20px 0px;
  }
`;

// Table Container allows Table display to work around parent padding and fill full modal width
const TableContainer = styled('div')<{height: number}>`
  height: ${p => p.height}px;
  width: calc(100% + 60px);
  max-width: 1400px;
  position: relative;
  left: -${space(4)};

  & > div {
    max-height: ${p => p.height}px;
    margin: 0;
  }
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  box-shadow: none;
`;

export default withRouter(withPageFilters(WidgetViewerModal));
