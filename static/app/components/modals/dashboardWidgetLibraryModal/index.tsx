import * as React from 'react';
import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps, openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import Tag from 'sentry/components/tagDeprecated';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  DashboardDetails,
  DashboardWidgetSource,
  MAX_WIDGETS,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import DashboardWidgetLibraryTab from './libraryTab';

export type DashboardWidgetLibraryModalOptions = {
  organization: Organization;
  dashboard: DashboardDetails;
  initialSelectedWidgets?: WidgetTemplate[];
  customWidget?: Widget;
  onAddWidget: (widgets: Widget[]) => void;
};

export enum TAB {
  Library = 'library',
  Custom = 'custom',
}

type Props = ModalRenderProps & DashboardWidgetLibraryModalOptions;

function DashboardWidgetLibraryModal({
  Header,
  Body,
  Footer,
  dashboard,
  organization,
  customWidget,
  initialSelectedWidgets,
  closeModal,
  onAddWidget,
}: Props) {
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetTemplate[]>(
    initialSelectedWidgets ? initialSelectedWidgets : []
  );
  const [errored, setErrored] = useState(false);

  function handleSubmit() {
    onAddWidget([...dashboard.widgets, ...selectedWidgets]);
    closeModal();
  }

  return (
    <React.Fragment>
      <Header closeButton>
        <h4>{t('Add Widget')}</h4>
      </Header>
      <Body>
        <StyledButtonBar>
          <Button
            barId={TAB.Custom}
            onClick={() => {
              openAddDashboardWidgetModal({
                organization,
                dashboard,
                selectedWidgets,
                widget: customWidget,
                source: DashboardWidgetSource.LIBRARY,
                onAddLibraryWidget: onAddWidget,
              });
            }}
          >
            {t('Custom')}
          </Button>
        </StyledButtonBar>
        <DashboardWidgetLibraryTab
          selectedWidgets={selectedWidgets}
          errored={errored}
          setSelectedWidgets={setSelectedWidgets}
          setErrored={setErrored}
        />
      </Body>
      <Footer>
        <FooterButtonbar gap={1}>
          <Button
            external
            href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
          >
            {t('Read the docs')}
          </Button>
          <div>
            <SelectedBadge data-test-id="selected-badge">
              {`${selectedWidgets.length} Selected`}
            </SelectedBadge>
            <Tooltip
              title={tct('Max widgets ([maxWidgets]) per dashboard exceeded.', {
                maxWidgets: MAX_WIDGETS,
              })}
              disabled={
                !!!(dashboard.widgets.length + selectedWidgets.length >= MAX_WIDGETS)
              }
            >
              <Button
                data-test-id="confirm-widgets"
                disabled={dashboard.widgets.length + selectedWidgets.length > MAX_WIDGETS}
                priority="primary"
                type="button"
                onClick={(event: React.FormEvent) => {
                  event.preventDefault();
                  if (!!!selectedWidgets.length) {
                    setErrored(true);
                    return;
                  }
                  handleSubmit();
                }}
              >
                {t('Confirm')}
              </Button>
            </Tooltip>
          </div>
        </FooterButtonbar>
      </Footer>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-bottom: ${space(1)};
`;

const FooterButtonbar = styled(ButtonBar)`
  justify-content: space-between;
  width: 100%;
`;

const SelectedBadge = styled(Tag)`
  padding: 3px ${space(0.75)};
  display: inline-flex;
  align-items: center;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  top: -1px;
`;

export default DashboardWidgetLibraryModal;
