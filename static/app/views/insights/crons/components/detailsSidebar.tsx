import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {ActorAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {useDrawer, DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SectionHeading} from 'sentry/components/charts/styles';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCopyId, IconJson} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {getFormattedDate} from 'sentry/utils/dates';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {DetailsTimelineLegend} from 'sentry/views/insights/crons/components/detailsTimelineLegend';
import type {Monitor, MonitorEnvironment} from 'sentry/views/insights/crons/types';
import {ScheduleType} from 'sentry/views/insights/crons/types';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

import {MonitorQuickStartGuide} from './monitorQuickStartGuide';

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
        <IconCopyId size="xs" />
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
      <Container marginBottom="xl">
        <DescriptionList>
          <DescriptionList.Term>{t('Monitor Slug')}</DescriptionList.Term>
          <DescriptionList.Details>{slug}</DescriptionList.Details>
          <DescriptionList.Term>{t('Failure tolerance')}</DescriptionList.Term>
          <DescriptionList.Details>
            {tn(
              '%s check-in',
              '%s check-ins',
              monitor.config.failure_issue_threshold ?? 1
            )}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Recovery tolerance')}</DescriptionList.Term>
          <DescriptionList.Details>
            {tn('%s check-in', '%s check-ins', monitor.config.recovery_threshold ?? 1)}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Owner')}</DescriptionList.Term>
          <DescriptionList.Details>
            {monitor.owner ? <ActorAvatar actor={monitor.owner} /> : t('Unassigned')}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Date created')}</DescriptionList.Term>
          <DescriptionList.Details>
            {getFormattedDate(monitor.dateCreated, 'MMM D, YYYY')}
          </DescriptionList.Details>
        </DescriptionList>
      </Container>
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
  font-family: ${p => p.theme.font.family.mono};
  color: ${p => p.theme.tokens.content.secondary};
`;

const MonitorSlug = styled('button')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${p => p.theme.space.xs};

  padding: 0;
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
