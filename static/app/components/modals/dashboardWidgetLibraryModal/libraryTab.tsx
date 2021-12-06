import * as React from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DEFAULT_WIDGETS,
  WidgetTemplate,
} from 'sentry/views/dashboardsV2/widgetLibrary/data';
import WidgetLibraryCard from 'sentry/views/dashboardsV2/widgetLibrary/widgetCard';

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
      <WidgetLibraryGrid>
        {DEFAULT_WIDGETS.map((widgetCard, index) => {
          return (
            <WidgetLibraryCard
              data-test-id={`widget-library-card-${index}`}
              key={widgetCard.title}
              widget={widgetCard}
              selectedWidgets={selectedWidgets}
              setSelectedWidgets={setSelectedWidgets}
              setErrored={setErrored}
            />
          );
        })}
      </WidgetLibraryGrid>
    </React.Fragment>
  );
}

const WidgetLibraryGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(100px, 1fr));
  grid-template-rows: repeat(2, max-content);
  row-gap: ${space(1.5)};
  column-gap: ${space(2)};
`;

export default DashboardWidgetLibraryTab;
