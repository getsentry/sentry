import * as React from 'react';
import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Tag from 'app/components/tagDeprecated';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {DashboardDetails} from 'app/views/dashboardsV2/types';
import {DEFAULT_WIDGETS, WidgetTemplate} from 'app/views/dashboardsV2/widgetLibrary/data';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import DashboardWidgetCustomTab from './customTab';
import DashboardWidgetLibraryTab from './libraryTab';

export type DashboardWidgetLibraryModalOptions = {
  organization: Organization;
  dashboard: DashboardDetails;
};

export enum TAB {
  Library = 'library',
  Custom = 'custom',
}

type Props = ModalRenderProps & DashboardWidgetLibraryModalOptions;

function DashboardWidgetLibraryModal({Header, Body, Footer}: Props) {
  const [tab, setTab] = useState(TAB.Library);
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetTemplate[]>([]);

  return (
    <React.Fragment>
      <Header closeButton>
        <h4>{t('Add Widget')}</h4>
      </Header>
      <Body>
        <StyledButtonBar active={tab}>
          <Button barId={TAB.Library} onClick={() => setTab(TAB.Library)}>
            {t('Library')}
          </Button>
          <Button barId={TAB.Custom} onClick={() => setTab(TAB.Custom)}>
            {t('Custom')}
          </Button>
        </StyledButtonBar>
        <Title>{t('%s WIDGETS', DEFAULT_WIDGETS.length)}</Title>
        {tab === TAB.Library ? (
          <DashboardWidgetLibraryTab
            selectedWidgets={selectedWidgets}
            setSelectedWidgets={setSelectedWidgets}
          />
        ) : (
          <DashboardWidgetCustomTab />
        )}
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
            <Button
              data-test-id="add-widget"
              priority="primary"
              type="button"
              onClick={() => {}}
            >
              {t('Add Widget')}
            </Button>
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: ${space(1)};
`;

const FooterButtonbar = styled(ButtonBar)`
  justify-content: space-between;
  width: 100%;
`;

const Title = styled('h3')`
  margin-bottom: ${space(1)};
  padding: 0 !important;
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
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
