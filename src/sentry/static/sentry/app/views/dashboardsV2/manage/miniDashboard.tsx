import React from 'react';
import styled from '@emotion/styled';

import WidgetArea from 'sentry-images/dashboards/widget-area.svg';
import WidgetBar from 'sentry-images/dashboards/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboards/widget-big-number.svg';
import WidgetLine3 from 'sentry-images/dashboards/widget-line-3.svg';
import WidgetTable from 'sentry-images/dashboards/widget-table.svg';
import WidgetWorldMap from 'sentry-images/dashboards/widget-world-map.svg';

import MiniCard from 'app/components/miniCard';
import TimeSince from 'app/components/timeSince';
import {tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import {DashboardDetailedListItem, DisplayType} from 'app/views/dashboardsV2/types';
import {WidgetContainer} from 'app/views/dashboardsV2/utils';

type Props = {
  organization: Organization;
  dashboard: DashboardDetailedListItem;
};

const MiniWidgetImg = styled('img')`
  width: 100%;
  height: 100%;
`;

const BigMiniWidgetImg = styled(MiniWidgetImg)`
  grid-area: span 2 / span 2;
`;

const miniWidgets: Record<DisplayType, React.ReactElement> = {
  area: <BigMiniWidgetImg src={WidgetArea} />,
  bar: <BigMiniWidgetImg src={WidgetBar} />,
  big_number: <MiniWidgetImg src={WidgetBigNumber} />,
  line: <BigMiniWidgetImg src={WidgetLine3} />,
  stacked_area: <BigMiniWidgetImg src={WidgetArea} />,
  table: <BigMiniWidgetImg src={WidgetTable} />,
  world_map: <BigMiniWidgetImg src={WidgetWorldMap} />,
};

class MiniDashboard extends React.PureComponent<Props> {
  render() {
    const {organization, dashboard} = this.props;
    return (
      <MiniCard
        title={dashboard.title}
        detail={tn('%s widget', '%s widgets', dashboard.widgets.length)}
        to={`/organizations/${organization.slug}/dashboards/${dashboard.id}`}
        createdBy={dashboard.createdBy}
        dateStatus={
          dashboard.dateCreated
            ? tct('Created [dateCreated]', {
                dateCreated: <TimeSince date={dashboard.dateCreated} />,
              })
            : '\u00A0'
        }
        bodyHeight="200px"
      >
        <StyledWidgetContainer>
          {dashboard.widgets.map((widget, index) =>
            React.cloneElement(miniWidgets[widget.displayType], {
              key: `${index}-${widget.id}`,
            })
          )}
        </StyledWidgetContainer>
      </MiniCard>
    );
  }
}

const StyledWidgetContainer = styled(WidgetContainer)`
  grid-gap: ${space(0.5)};
  padding: ${space(1)};
`;

export default withOrganization(MiniDashboard);
