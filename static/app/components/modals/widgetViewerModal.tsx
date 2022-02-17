import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {getFieldsFromEquations} from 'sentry/views/dashboardsV2/utils';
import WidgetCardChartContainer from 'sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer';

export type WidgetViewerModalOptions = {
  organization: Organization;
  widget: Widget;
};

type Props = ModalRenderProps &
  WidgetViewerModalOptions & {
    organization: Organization;
    selection: PageFilters;
  };

const TABLE_ITEM_LIMIT = 30;
const FULL_TABLE_HEIGHT = 600;
const HALF_TABLE_HEIGHT = 300;

function WidgetViewerModal(props: Props) {
  const renderWidgetViewer = () => {
    const {organization, selection, widget} = props;
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
  };

  const {Footer, Body, Header, widget} = props;

  const StyledHeader = styled(Header)`
    ${headerCss}
  `;
  const StyledFooter = styled(Footer)`
    ${footerCss}
  `;
  const openLabel =
    widget.widgetType === WidgetType.ISSUE ? t('Open in Issues') : t('Open in Discover');
  return (
    <React.Fragment>
      <StyledHeader closeButton>
        <h4>{widget.title}</h4>
      </StyledHeader>
      <Body>{renderWidgetViewer()}</Body>
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

export default withPageFilters(WidgetViewerModal);
