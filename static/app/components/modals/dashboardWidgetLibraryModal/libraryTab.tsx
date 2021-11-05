import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {DEFAULT_WIDGETS} from 'app/views/dashboardsV2/widgetLibrary/data';
import WidgetLibraryCard from 'app/views/dashboardsV2/widgetLibrary/widgetCard';

function DashboardWidgetLibraryTab() {
  return (
    <React.Fragment>
      <ScrollGrid>
        <WidgetLibraryGrid>
          {DEFAULT_WIDGETS.map(widgetCard => {
            return (
              <WidgetLibraryCard
                key={widgetCard.title}
                title={widgetCard.title}
                displayType={widgetCard.displayType}
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

export default DashboardWidgetLibraryTab;
