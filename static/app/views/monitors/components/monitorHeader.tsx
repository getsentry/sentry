import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {SectionHeading} from 'sentry/components/charts/styles';
import Clipboard from 'sentry/components/clipboard';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {MonitorStatus} from '../types';

import MonitorHeaderActions from './monitorHeaderActions';
import MonitorIcon from './monitorIcon';

type Props = React.ComponentProps<typeof MonitorHeaderActions>;

const statusToLabel: Record<MonitorStatus, string> = {
  ok: t('Ok'),
  error: t('Failed'),
  disabled: t('Disabled'),
  active: t('Active'),
  missed_checkin: t('Missed'),
};

const MonitorHeader = ({monitor, orgId, onUpdate}: Props) => {
  const crumbs = [
    {
      label: t('Crons'),
      to: `/organizations/${orgId}/crons/`,
    },
    {
      label: t('Cron Monitor Details'),
    },
  ];

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={crumbs} />
        <Layout.Title>
          <IdBadge
            project={monitor.project}
            avatarSize={28}
            hideName
            avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
          />
          {monitor.name}
        </Layout.Title>
        <Clipboard value={monitor.slug}>
          <MonitorSlug>
            {monitor.slug} <IconCopy size="xs" />
          </MonitorSlug>
        </Clipboard>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <MonitorHeaderActions orgId={orgId} monitor={monitor} onUpdate={onUpdate} />
        <MonitorStats>
          <MonitorStatLabel>{t('Last Check-in')}</MonitorStatLabel>
          <MonitorStatLabel>{t('Next Check-in')}</MonitorStatLabel>
          <MonitorStatLabel>{t('Status')}</MonitorStatLabel>
          <div>
            {monitor.lastCheckIn && (
              <TimeSince
                unitStyle="regular"
                liveUpdateInterval="second"
                date={monitor.lastCheckIn}
              />
            )}
          </div>
          <div>
            {monitor.nextCheckIn && (
              <TimeSince
                unitStyle="regular"
                liveUpdateInterval="second"
                date={monitor.nextCheckIn}
              />
            )}
          </div>
          <Status>
            <MonitorIcon status={monitor.status} size={16} />
            <MonitorStatusLabel>{statusToLabel[monitor.status]}</MonitorStatusLabel>
          </Status>
        </MonitorStats>
      </Layout.HeaderActions>
    </Layout.Header>
  );
};

const MonitorSlug = styled('div')`
  margin-top: ${space(1)};
  color: ${p => p.theme.subText};
  cursor: pointer;
  width: max-content;
`;

const MonitorStats = styled('div')`
  display: grid;
  align-self: flex-end;
  grid-template-columns: repeat(3, max-content);
  grid-column-gap: ${space(4)};
  grid-row-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
  margin-top: ${space(1)};
`;

const MonitorStatLabel = styled(SectionHeading)`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: center;
`;

const Status = styled('div')`
  display: flex;
  align-items: center;
`;

const MonitorStatusLabel = styled('div')`
  margin-left: ${space(1)};
`;

export default MonitorHeader;
