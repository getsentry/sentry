import AttachmentUrl from 'sentry/components/attachmentUrl';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {DeviceName} from 'sentry/components/deviceName';
import FileSize from 'sentry/components/fileSize';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {AvatarUser, Organization, Tag} from 'sentry/types';
import {Event} from 'sentry/types/event';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  event: Event;
  groupId: string;
  orgId: string;
  organization: Organization;
  projectId: string;
  tagList: Tag[];
  className?: string;
  hasUser?: boolean;
};

function EventsTableRow({
  className,
  event,
  projectId,
  orgId,
  groupId,
  tagList,
  hasUser,
  organization,
}: Props) {
  const routes = useRoutes();

  const crashFileLink = !event.crashFile ? null : (
    <AttachmentUrl projectId={projectId} eventId={event.id} attachment={event.crashFile}>
      {url =>
        url ? (
          <small>
            {event.crashFile?.type === 'event.minidump' ? 'Minidump' : 'Crash file'}:{' '}
            <a href={`${url}?download=1`}>{event.crashFile?.name}</a> (
            <FileSize bytes={event.crashFile?.size || 0} />)
          </small>
        ) : null
      }
    </AttachmentUrl>
  );

  const tagMap = Object.fromEntries(event.tags.map(tag => [tag.key, tag.value]));

  const hasReplay = Boolean(tagMap.replayId);
  const fullReplayUrl = {
    pathname: `/organizations/${organization.slug}/replays/${projectId}:${tagMap.replayId}/`,
    query: {
      referrer: getRouteStringFromRoutes(routes),
      event_t: event.dateCreated ? new Date(event.dateCreated).getTime() : undefined,
    },
  };

  return (
    <tr key={event.id} className={className}>
      <td>
        <h5>
          <GlobalSelectionLink
            to={`/organizations/${orgId}/issues/${groupId}/events/${event.id}/?referrer=events-table`}
          >
            <DateTime date={event.dateCreated} year seconds timeZone />
          </GlobalSelectionLink>
          <small>{event.title.substr(0, 100)}</small>
          {crashFileLink}
        </h5>
      </td>

      {hasUser && (
        <td className="event-user table-user-info">
          {event.user ? (
            <div>
              <UserAvatar
                // TODO(ts): Some of the user fields are optional from event,
                // this cast can probably be removed in the future
                user={event.user as AvatarUser}
                size={24}
                className="avatar"
                gravatar={false}
              />
              {event.user.email}
            </div>
          ) : (
            <span>—</span>
          )}
        </td>
      )}

      {tagList.map(tag => (
        <td key={tag.key}>
          <div>
            {tag.key === 'device' ? (
              <DeviceName value={tagMap[tag.key]} />
            ) : tag.key === 'replayId' ? (
              hasReplay ? (
                <Button
                  to={fullReplayUrl}
                  size="sm"
                  icon={<IconPlay size="sm" />}
                  aria-label={t('View Full Replay')}
                />
              ) : null
            ) : (
              tagMap[tag.key]
            )}
          </div>
        </td>
      ))}
    </tr>
  );
}

export default withOrganization(EventsTableRow);
