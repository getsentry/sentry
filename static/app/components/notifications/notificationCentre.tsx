import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import Badge from 'sentry/components/badge/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Flex} from 'sentry/components/container/flex';
import {
  BreadcrumbDrawerBody,
  BreadcrumbDrawerHeader,
  SearchInput,
} from 'sentry/components/events/breadcrumbs/breadcrumbsDrawer';
import {InputGroup} from 'sentry/components/inputGroup';
import {NotificationItem} from 'sentry/components/notifications/notificationItem';
import {useUserInAppNotifications} from 'sentry/components/notifications/useUserInAppNotifications';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconFilter, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  NotificationHistoryStatus,
  NotificationMailboxes,
} from 'sentry/types/notifications';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

interface NotificationCentreProps {}

export function NotificationCentre({}: NotificationCentreProps) {
  const theme = useTheme();
  const {data: notifs = []} = useUserInAppNotifications();
  const [search, setSearch] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [mailbox, setMailbox] = useState<NotificationMailboxes>(
    NotificationMailboxes.UNREAD
  );

  const sourceOptions = useMemo(() => {
    const allUniqueSources = notifs.reduce<Set<string>>(
      (uniqueSources, notif) => new Set([...uniqueSources, notif.source]),
      new Set<string>()
    );

    return [...allUniqueSources, ...['tester', 'email', 'other']].map(source => ({
      value: source,
      label: toTitleCase(source),
    }));
  }, [notifs]);

  const displayNotifs = useMemo(() => {
    const mailboxNotifs =
      mailbox === NotificationMailboxes.ALL
        ? notifs
        : notifs.filter(notif => `${notif.status}` === mailbox);
    const filteredNotifs = sources.length
      ? mailboxNotifs.filter(notif => sources.includes(notif.source))
      : mailboxNotifs;
    const searchedNotifs = filteredNotifs.filter(
      notif => notif.description.includes(search) || notif.title.includes(search)
    );
    return searchedNotifs;
  }, [mailbox, notifs, sources, search]);

  const mailboxData = useMemo(
    () =>
      notifs.reduce<Record<NotificationMailboxes, number>>(
        (mbData, notif) => {
          const data = {...mbData};
          data[NotificationMailboxes.ALL] += 1;
          switch (notif.status) {
            case NotificationHistoryStatus.UNREAD:
            case NotificationHistoryStatus.ARCHIVED:
              data[notif.status] += 1;
              break;
            default:
              break;
          }
          return data;
        },
        {
          [NotificationMailboxes.ALL]: 0,
          [NotificationMailboxes.UNREAD]: 0,
          [NotificationMailboxes.ARCHIVED]: 0,
        }
      ),
    [notifs]
  );

  const actions = (
    <ActionBar gap={1}>
      <InputGroup>
        <SearchInput size="xs" value={search} onChange={e => setSearch(e.target.value)} />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <CompactSelect
        size="xs"
        onChange={options => {
          const newSources = options.map(({value}) => value);
          setSources(newSources);
        }}
        multiple
        options={sourceOptions}
        maxMenuHeight={400}
        trigger={props => (
          <Button
            size="xs"
            borderless
            style={{background: sources.length > 0 ? theme.purple100 : 'transparent'}}
            icon={<IconFilter />}
            aria-label={t('Filter Notifications')}
            {...props}
          >
            {sources.length > 0 ? sources.length : null}
          </Button>
        )}
      />
      <SegmentedControl
        size="xs"
        aria-label={t('Switch mailbox')}
        value={mailbox}
        onChange={m => setMailbox(m)}
      >
        {Object.entries(mailboxData).map(([mb, mbCount]) => (
          <SegmentedControl.Item key={mb} aria-label={mb}>
            <Flex align="center">
              {toTitleCase(mb)}
              <Badge type="gray" text={mbCount} />
            </Flex>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
    </ActionBar>
  );

  return (
    <DrawerContainer>
      <BreadcrumbDrawerHeader>
        <Header>
          {t('Notification Centre')}
          {actions}
        </Header>
      </BreadcrumbDrawerHeader>
      {displayNotifs.length ? (
        <BreadcrumbDrawerBody>
          <NotificationContainer>
            {displayNotifs.map(notification => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </NotificationContainer>
        </BreadcrumbDrawerBody>
      ) : (
        <EmptyNotificationCentre>
          <EmptyText>
            <div>{t('No-tifications!')}</div>
          </EmptyText>
          <EmptyImage
            src={waitingForEventImg}
            alt={t('No notifications found')}
            height={150}
          />
          <EmptyText>
            <div>{t('You must be doing something right!')}</div>
            <div>
              <i>{t('(or very, very wrong...)')}</i>
            </div>
          </EmptyText>
        </EmptyNotificationCentre>
      )}
    </DrawerContainer>
  );
}

const DrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
`;

const NotificationContainer = styled('div')`
  padding: 0 ${space(1)};
`;

const EmptyImage = styled('img')`
  opacity: 0.5;
  margin: ${space(2)} ${space(3)};
`;

const EmptyNotificationCentre = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.disabled};
`;

const EmptyText = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  text-align: center;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const ActionBar = styled(ButtonBar)`
  justify-self: flex-end;
`;
