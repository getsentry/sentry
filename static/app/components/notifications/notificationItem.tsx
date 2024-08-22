import styled from '@emotion/styled';
import moment from 'moment';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Badge from 'sentry/components/badge/badge';
import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {Timestamp} from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {getNotificationData} from 'sentry/components/notifications/util';
import Timeline, {type ColorConfig} from 'sentry/components/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArchive, IconSettings, IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {
  type NotificationHistory,
  NotificationHistoryStatus,
} from 'sentry/types/notifications';
import {shouldUse24Hours} from 'sentry/utils/dates';
import useMutateInAppNotification from 'sentry/utils/useMutateInAppNotification';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';

function NotificationCrumbs({notification}: {notification: NotificationHistory}) {
  const {
    organization: organizationData,
    project: projectData,
    group,
  } = notification?.content ?? {};
  const crumbs: Crumb[] = [];
  const {projects} = useProjects();
  const {organizations} = useLegacyStore(OrganizationsStore);

  // XXX(Leander): Could match on an id of "undefined", but like who cares.
  const organization = organizations.find(o => o.id === `${organizationData?.id}`);
  const project = projects.find(p => p.id === `${projectData?.id}`);

  if (organization) {
    crumbs.push({
      label: (
        <CrumbWrapper>
          <OrganizationAvatar organization={organization} size={12} />
          <CrumbText>{organization.name}</CrumbText>
        </CrumbWrapper>
      ),
    });
  }
  if (project) {
    crumbs.push({
      label: (
        <CrumbWrapper>
          <ProjectAvatar project={project} size={12} />
          <CrumbText>{project.name}</CrumbText>
        </CrumbWrapper>
      ),
    });
  }
  if (group) {
    crumbs.push({label: <CrumbText>{group.shortId}</CrumbText>});
  }

  return <NotificationBreadcrumbBar crumbs={crumbs} />;
}

export function NotificationItem({notification}: {notification: NotificationHistory}) {
  const {mutate: updateNotif} = useMutateInAppNotification({
    notifId: notification.id,
  });
  const navigate = useNavigate();
  const {colorConfig, icon} = getNotificationData(notification);

  const absoluteFormat = shouldUse24Hours() ? 'HH:mm:ss.SSS' : 'hh:mm:ss.SSS';

  const now = new Date();
  const notifTime = new Date(notification.date_added);
  const isUnread = notification.status === NotificationHistoryStatus.UNREAD;

  return (
    <Container>
      <NotificationCrumbs notification={notification} />
      <NotificationControls>
        <NotificationControl
          borderless
          icon={
            <IconShow
              isHidden={notification.status !== NotificationHistoryStatus.UNREAD}
            />
          }
          size="xs"
          title={isUnread ? t('Mark as read') : t('Mark unread')}
          aria-label={isUnread ? t('Mark as read') : t('Mark unread')}
          onClick={() => updateNotif({status: NotificationHistoryStatus.READ})}
        />
        <NotificationControl
          borderless
          icon={<IconArchive />}
          size="xs"
          title={t('Archive')}
          aria-label={t('Archive')}
          onClick={() => updateNotif({status: NotificationHistoryStatus.ARCHIVED})}
        />
        <NotificationControl
          borderless
          icon={<IconSettings />}
          size="xs"
          title={t('Modify in Settings')}
          aria-label={t('Modify in Settings')}
          onClick={() =>
            navigate(`/settings/account/notifications/${notification.source}/`)
          }
        />
      </NotificationControls>
      <Item
        icon={icon}
        colorConfig={isUnread ? colorConfig : undefined}
        title={
          <Title isUnread={isUnread}>
            <div>{notification.title}</div>
            <NotificationBadge text={notification.source} colorConfig={colorConfig} />
          </Title>
        }
        isActive
        timestamp={
          <Timestamp>
            <Tooltip
              title={<DateTime date={notifTime} format={`ll - ${absoluteFormat} (z)`} />}
            >
              <Duration seconds={moment(notifTime).diff(moment(now), 's')} abbreviation />
            </Tooltip>
          </Timestamp>
        }
      >
        <Content isUnread={isUnread}>{notification.description}</Content>
        <NotificationActionBar notification={notification} />
      </Item>
    </Container>
  );
}

function NotificationActionBar({}: {notification: NotificationHistory}) {
  return (
    <ButtonBar gap={1}>
      <Button size="sm">Action 1</Button>
      <Button size="sm">Action 2</Button>
      <Button size="sm">Action 3</Button>
    </ButtonBar>
  );
}

const Container = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  margin-bottom: ${space(2)};
  display: grid;
  grid-template:
    'breadcrumbs breadcrumbs'
    'item        controls' / auto 40px;
`;

const NotificationBreadcrumbBar = styled(Breadcrumbs)`
  grid-area: breadcrumbs;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(0.75)} ${space(1)};
  background-image: linear-gradient(
    to right,
    ${p => p.theme.background},
    ${p => p.theme.backgroundSecondary}
  );
`;

const NotificationControls = styled('div')`
  grid-area: controls;
  border-left: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
  gap: ${space(1)};
`;

const NotificationBadge = styled(Badge)<{colorConfig: ColorConfig}>`
  border: 1px solid ${p => p.theme[p.colorConfig.iconBorder]};
  color: ${p => p.theme[p.colorConfig.title]};
  background: transparent;
`;

const NotificationControl = styled(Button)``;

const Item = styled(Timeline.Item)`
  grid-area: item;
  padding: ${space(1.5)} ${space(3)};
`;

const Content = styled('div')<{isUnread: boolean}>`
  margin-bottom: ${space(2)};
  color: ${p => (p.isUnread ? p.theme.textColor : p.theme.subText)};
`;

const Title = styled('div')<{isUnread: boolean}>`
  display: flex;
  justify-content: space-between;
  font-weight: ${p => (p.isUnread ? p.theme.fontWeightBold : p.theme.fontWeightNormal)};
  color: ${p => (p.isUnread ? p.theme.textColor : p.theme.subText)};
`;

const CrumbWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const CrumbText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;
