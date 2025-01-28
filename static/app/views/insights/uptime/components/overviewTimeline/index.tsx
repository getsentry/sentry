import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {Sticky} from 'sentry/components/sticky';
import type {UptimeAlert} from 'sentry/views/alerts/types';

import {OverviewRow} from './overviewRow';

interface Props {
  uptimeAlerts: UptimeAlert[];
}

export function OverviewTimeline({uptimeAlerts}: Props) {
  return (
    <MonitorListPanel role="region">
      <Header />
      <UptimeAlertRow>
        {uptimeAlerts.map(uptimeAlert => (
          <OverviewRow key={uptimeAlert.id} uptimeAlert={uptimeAlert} />
        ))}
      </UptimeAlertRow>
    </MonitorListPanel>
  );
}

const Header = styled(Sticky)`
  display: grid;
  grid-column: 1/-1;
  grid-template-columns: subgrid;

  z-index: 1;
  background: ${p => p.theme.background};
  border-top-left-radius: ${p => p.theme.panelBorderRadius};
  border-top-right-radius: ${p => p.theme.panelBorderRadius};
  box-shadow: 0 1px ${p => p.theme.translucentBorder};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    margin: 0 -1px;
  }
`;

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 1fr max-content;
`;

const UptimeAlertRow = styled('ul')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  list-style: none;
  padding: 0;
  margin: 0;
`;
