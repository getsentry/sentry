import * as React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DEFAULT_WIDGETS, WidgetTemplate} from 'app/views/dashboardsV2/widgetLibrary/data';
import WidgetLibraryCard from 'app/views/dashboardsV2/widgetLibrary/widgetCard';

type Props = {
  selectedWidgets: WidgetTemplate[];
  errored: boolean;
  setSelectedWidgets: (widgets: WidgetTemplate[]) => void;
  setErrored: (errored: boolean) => void;
};

function DashboardWidgetLibraryTab({
  selectedWidgets,
  errored,
  setSelectedWidgets,
  setErrored,
}: Props) {
  return (
    <React.Fragment>
      {errored && !!!selectedWidgets.length ? (
        <Alert type="error">
          {t(
            'Please select at least one Widget from our Library. Alternatively, you can build a custom widget from scratch.'
          )}
        </Alert>
      ) : null}
      <Title>{t('%s WIDGETS', DEFAULT_WIDGETS.length)}</Title>
      <ScrollGrid>
        <WidgetLibraryGrid>
          {DEFAULT_WIDGETS.map(widgetCard => {
            return (
              <WidgetLibraryCard
                key={widgetCard.title}
                widget={widgetCard}
                selectedWidgets={selectedWidgets}
                setSelectedWidgets={setSelectedWidgets}
                setErrored={setErrored}
              />
            );
          })}
        </WidgetLibraryGrid>
      </ScrollGrid>
    </React.Fragment>
  );
}

const WidgetLibraryGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(100px, 1fr));
  grid-template-rows: repeat(2, max-content);
  grid-gap: ${space(1)};
`;

const ScrollGrid = styled('div')`
  max-height: 550px;
  overflow: scroll;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Title = styled('h3')`
  margin-bottom: ${space(1)};
  padding: 0 !important;
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
`;

export default DashboardWidgetLibraryTab;
