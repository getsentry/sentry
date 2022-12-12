import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {SectionHeading} from 'sentry/components/charts/styles';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import MonitorHeaderActions from './monitorHeaderActions';
import MonitorIcon from './monitorIcon';
import {Status} from './types';

type Props = React.ComponentProps<typeof MonitorHeaderActions>;

const statusToLabel: Record<Status, string> = {
  ok: t('Ok'),
  error: t('Failed'),
  disabled: t('Disabled'),
  active: t('Active'),
  missed_checkin: t('Missed'),
};

const MonitorHeader = ({monitor, orgId, onUpdate}: Props) => {
  const crumbs = [
    {
      label: t('Monitors'),
      to: `/organizations/${orgId}/monitors`,
    },
    {
      label: t('Monitor Details'),
    },
  ];

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={crumbs} />
        <Layout.Title>
          <MonitorName>
            <IdBadge
              project={monitor.project}
              avatarSize={28}
              hideName
              avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
            />
            {monitor.name}
          </MonitorName>
        </Layout.Title>
        <MonitorId>{monitor.id}</MonitorId>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <MonitorHeaderActions orgId={orgId} monitor={monitor} onUpdate={onUpdate} />
        <MonitorStats>
          <MonitorStatLabel>{t('Last Check-in')}</MonitorStatLabel>
          <MonitorStatLabel>{t('Next Check-in')}</MonitorStatLabel>
          <MonitorStatLabel>{t('Status')}</MonitorStatLabel>
          <div>{monitor.lastCheckIn && <TimeSince date={monitor.lastCheckIn} />}</div>
          <div>{monitor.nextCheckIn && <TimeSince date={monitor.nextCheckIn} />}</div>
          <MonitorStatus>
            <MonitorIcon status={monitor.status} size={16} />
            <MonitorStatusLabel>{statusToLabel[monitor.status]}</MonitorStatusLabel>
          </MonitorStatus>
        </MonitorStats>
      </Layout.HeaderActions>
    </Layout.Header>
  );
};

const MonitorName = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1)};
  align-items: center;
`;

const MonitorId = styled('div')`
  margin-top: ${space(1)};
  color: ${p => p.theme.subText};
`;

const MonitorStats = styled('div')`
  display: grid;
  align-self: flex-end;
  grid-template-columns: repeat(3, max-content);
  grid-column-gap: ${space(4)};
  grid-row-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
`;

const MonitorStatLabel = styled(SectionHeading)`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: center;
`;

const MonitorStatus = styled('div')`
  display: flex;
  align-items: center;
`;

const MonitorStatusLabel = styled('div')`
  margin-left: ${space(1)};
`;

export default MonitorHeader;
