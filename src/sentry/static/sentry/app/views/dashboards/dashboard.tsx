import React from 'react';
import styled from '@emotion/styled';
import {InjectedRouter} from 'react-router/lib/Router';

import space from 'app/styles/space';
import {Release, Widget} from 'app/types';

import WidgetComponent from './widgetComponent';

type Props = {
  releasesLoading: boolean;
  releases: Array<Release>;
  widgets: Array<Widget>;
  router: InjectedRouter;
};

function Dashboard({releasesLoading, releases, widgets, router}: Props) {
  return (
    <Widgets>
      {widgets.map((widget, i) => (
        <WidgetWrapper key={i}>
          <WidgetComponent
            releasesLoading={releasesLoading}
            releases={releases}
            widget={widget}
            router={router}
          />
        </WidgetWrapper>
      ))}
    </Widgets>
  );
}
export default Dashboard;

const Widgets = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;
const WidgetWrapper = styled('div')`
  width: 50%;
  :nth-child(odd) {
    padding-right: ${space(2)};
  }
`;
