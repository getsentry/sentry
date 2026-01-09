import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import {SectionHeading} from 'sentry/components/charts/styles';
import {Alert} from 'sentry/components/core/alert';
import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy, IconJson} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {getFormattedDate} from 'sentry/utils/dates';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {DetailsTimelineLegend} from 'sentry/views/insights/crons/components/detailsTimelineLegend';
import type {Monitor, MonitorEnvironment} from 'sentry/views/insights/crons/types';
import {ScheduleType} from 'sentry/views/insights/crons/types';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

import MonitorQuickStartGuide from './monitorQuickStartGuide';

interface Props {
  monitor: Monitor;
  monitorEnv?: MonitorEnvironment;
  /**
   * Include the UNKNOWN status in the check-in type legend
   */
  showUnknownLegend?: boolean;
}

export function DetailsSidebar({monitorEnv, monitor, showUnknownLegend}: Props) {
  const {checkin_margin, schedule, schedule_type, max_runtime, timezone} = monitor.config;
  const {copy} = useCopyToClipboard();
  const openDocsPanel = useDocsPanel(monitor);

  const hasCheckIns = monitor.environments.some(e => e.lastCheckIn);

  const slug = (
    <Tooltip title={t('Copy monitor slug to clipboard')}>
      <MonitorSlug
        onClick={() => copy(monitor.slug, {successMessage: 'Copied to clipboard'})}
      >
        <SlugText>{monitor.slug}</SlugText>
        <IconCopy size="xs" />
      </MonitorSlug>
    </Tooltip>
  );

  return (
    <Fragment>
      <CheckIns>
        <SectionHeading>{t('Last Check-In')}</SectionHeading>
        <SectionHeading>{t('Next Check-In')}</SectionHeading>
        <div>
          {monitorEnv?.lastCheckIn ? (
            <TimeSince
              unitStyle="regular"
              liveUpdateInterval="second"
              date={monitorEnv.lastCheckIn}
            />
          ) : (
            '-'
          )}
        </div>
        <div>
          {monitor.status !== 'disabled' && monitorEnv?.nextCheckIn ? (
            moment(monitorEnv.nextCheckIn).isAfter(moment()) ? (
              <TimeSince
                unitStyle="regular"
                liveUpdateInterval="second"
                date={monitorEnv.nextCheckIn}
              />
            ) : (
              t('Expected Now')
            )
          ) : (
            '-'
          )}
        </div>
      </CheckIns>
      <SectionHeading>{t('Schedule')}</SectionHeading>
      <Flex wrap="wrap" marginBottom="xl" gap="md">
        <Text>
          {scheduleAsText(monitor.config)}{' '}
          {schedule_type === ScheduleType.CRONTAB && `(${timezone})`}
        </Text>
        {schedule_type === ScheduleType.CRONTAB && (
          <CrontabText>({schedule})</CrontabText>
        )}
      </Flex>
      <Legend>
        <SectionHeading>{t('Legend')}</SectionHeading>
        <DetailsTimelineLegend
          checkInMargin={checkin_margin}
          maxRuntime={max_runtime}
          showUnknownLegend={showUnknownLegend}
        />
      </Legend>
      <SectionHeading>{t('Cron Details')}</SectionHeading>
      <KeyValueTable>
        <KeyValueTableRow keyName={t('Monitor Slug')} value={slug} />
        <KeyValueTableRow
          keyName={t('Failure tolerance')}
          value={tn(
            '%s check-in',
            '%s check-ins',
            monitor.config.failure_issue_threshold ?? 1
          )}
        />
        <KeyValueTableRow
          keyName={t('Recovery tolerance')}
          value={tn(
            '%s check-in',
            '%s check-ins',
            monitor.config.recovery_threshold ?? 1
          )}
        />
        <KeyValueTableRow
          keyName={t('Owner')}
          value={
            monitor.owner ? (
              <ActorAvatar size={24} actor={monitor.owner} />
            ) : (
              t('Unassigned')
            )
          }
        />
        <KeyValueTableRow
          keyName={t('Date created')}
          value={getFormattedDate(monitor.dateCreated, 'MMM D, YYYY')}
        />
      </KeyValueTable>
      {monitor.isUpserting && (
        <Alert.Container>
          <Alert variant="muted" icon={<IconJson />}>
            {t(
              'This monitor is managed in code and updates automatically with each check-in.'
            )}
          </Alert>
        </Alert.Container>
      )}
      {hasCheckIns && (
        <Button size="xs" onClick={openDocsPanel}>
          {t('Show Setup Docs')}
        </Button>
      )}
    </Fragment>
  );
}

function useDocsPanel(monitor: Monitor) {
  const {openDrawer} = useDrawer();

  const contents = (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerBody>
        <MonitorQuickStartGuide project={monitor.project} monitorSlug={monitor.slug} />
      </DrawerBody>
    </Fragment>
  );

  return () =>
    openDrawer(() => contents, {
      ariaLabel: t('See Setup Docs'),
      drawerKey: 'cron-docs',
      resizable: true,
    });
}

const CheckIns = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: ${p => p.theme.space.xl};

  h4 {
    margin-top: 0;
  }
`;

const Legend = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

const CrontabText = styled(Text)`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.tokens.content.secondary};
`;

const MonitorSlug = styled('button')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${p => p.theme.space.xs};

  background: transparent;
  border: none;
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const SlugText = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
