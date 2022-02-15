import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {getFieldsFromEquations} from 'sentry/utils/discover/fields';
import withApi from 'sentry/utils/withApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCardChartContainer from 'sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer';

export type WidgetViewerModalOptions = {
  organization: Organization;
  widget: Widget;
};

type Props = ModalRenderProps &
  WidgetViewerModalOptions & {
    api: Client;
    organization: Organization;
    selection: PageFilters;
  };

type State = {
  loading: boolean;
};

const TABLE_ITEM_LIMIT = 30;
const FULL_TABLE_HEIGHT = 600;
const HALF_TABLE_HEIGHT = 300;

class WidgetViewerModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
    };
  }

  renderWidgetViewer() {
    const {api, organization, selection, widget} = this.props;
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
          <WidgetCardChartContainer
            api={api}
            organization={organization}
            selection={selection}
            widget={tableWidget}
            tableItemLimit={TABLE_ITEM_LIMIT}
          />
        </TableContainer>
      </React.Fragment>
    );
  }

  render() {
    const {Footer, Body, Header, widget} = this.props;

    const StyledHeader = styled(Header)`
      ${headerCss}
    `;
    const StyledFooter = styled(Footer)`
      ${footerCss}
    `;
    const openLabel =
      widget.widgetType === WidgetType.ISSUE
        ? t('Open in Issues')
        : t('Open in Discover');
    return (
      <React.Fragment>
        <StyledHeader closeButton>
          <h4>{widget.title}</h4>
        </StyledHeader>
        <Body>{this.renderWidgetViewer()}</Body>
        <StyledFooter>
          <ButtonBar gap={1}>
            <Button type="button" onClick={() => undefined}>
              {t('Edit Widget')}
            </Button>
            <Button priority="primary" type="button" onClick={() => undefined}>
              {openLabel}
            </Button>
          </ButtonBar>
        </StyledFooter>
      </React.Fragment>
    );
  }
}

export const modalCss = css`
  width: 100%;
  max-width: 1400px;
  margin: 70px auto;
`;

const headerCss = css`
  margin: -30px -30px 0px -30px;
`;
const footerCss = css`
  margin: 0px -30px -30px;
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
  left: -30px;

  & > div {
    max-height: ${p => p.height}px;
    margin: 0;
  }
`;

export default withApi(withPageFilters(WidgetViewerModal));
