import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'sentry/components/activity/item/avatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import DateTime from 'sentry/components/dateTime';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AuditLog, Organization, User} from 'sentry/types';
import {shouldUse24Hours} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8,
};

const getAvatarDisplay = (logEntryUser: User | undefined) => {
  // Display Sentry's avatar for system or superuser-initiated events
  if (
    logEntryUser?.isSuperuser ||
    (logEntryUser?.name === 'Sentry' && logEntryUser?.email === undefined)
  ) {
    return <SentryAvatar type="system" size={36} />;
  }
  // Display user's avatar for non-superusers-initiated events
  if (logEntryUser !== undefined) {
    return <UserAvatar style={avatarStyle} user={logEntryUser} />;
  }
  return null;
};

const addUsernameDisplay = (logEntryUser: User | undefined) => {
  if (logEntryUser?.isSuperuser) {
    return (
      <Name data-test-id="actor-name">
        {logEntryUser.name}
        <StaffTag>{t('Sentry Staff')}</StaffTag>
      </Name>
    );
  }
  if (logEntryUser !== undefined) {
    return <Name data-test-id="actor-name">{logEntryUser.name}</Name>;
  }
  return null;
};

function AuditNote({entry, orgSlug}: {entry: AuditLog; orgSlug: Organization['slug']}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === String(entry.data.id));

  if (!project) {
    return <Note>{entry.note}</Note>;
  }

  const projectSlug = (
    <Link to={`/settings/${orgSlug}/projects/${project.slug}/`}>{entry.data.slug}</Link>
  );

  if (entry.event === 'project.create') {
    return (
      <Note>
        {tct('Created project [project-slug]', {['project-slug']: projectSlug})}
      </Note>
    );
  }

  if (entry.event === 'project.edit') {
    if (entry.data.old_slug && entry.data.new_slug) {
      return (
        <Note>
          {tct('Renamed project slug from [old-slug] to [new-slug]', {
            'old-slug': entry.data.old_slug,
            'new-slug': (
              <Link to={`/settings/${orgSlug}/projects/${entry.data.new_slug}/`}>
                {entry.data.new_slug}
              </Link>
            ),
          })}
        </Note>
      );
    }

    return (
      <Note>
        {tct('Edited project [project-slug] [note]', {
          ['project-slug']: projectSlug,
          note: entry.note.replace('edited project settings ', ''),
        })}
      </Note>
    );
  }

  if (entry.event === 'sampling.add') {
    return (
      <Note>
        {tct('Added server-side sampling rule in the project [project-slug]', {
          ['project-slug']: projectSlug,
        })}
      </Note>
    );
  }

  if (entry.event === 'sampling.remove') {
    return (
      <Note>
        {tct('Deleted server-side sampling rule in the project [project-slug]', {
          ['project-slug']: projectSlug,
        })}
      </Note>
    );
  }

  if (entry.event === 'sampling.edit') {
    return (
      <Note>
        {tct('Edited server-side sampling rule in the project [project-slug]', {
          ['project-slug']: projectSlug,
        })}
      </Note>
    );
  }

  if (entry.event === 'sampling.activate') {
    return (
      <Note>
        {tct('Enabled server-side sampling rule in the project [project-slug]', {
          ['project-slug']: projectSlug,
        })}
      </Note>
    );
  }

  if (entry.event === 'sampling.deactivate') {
    return (
      <Note>
        {tct('Disabled server-side sampling rule in the project [project-slug]', {
          ['project-slug']: projectSlug,
        })}
      </Note>
    );
  }

  return <Note>{entry.note}</Note>;
}

type Props = {
  entries: AuditLog[] | null;
  eventType: string | undefined;
  eventTypes: string[] | null;
  isLoading: boolean;
  onCursor: CursorHandler | undefined;
  onEventSelect: (value: string) => void;
  pageLinks: string | null;
};

const AuditLogList = ({
  isLoading,
  pageLinks,
  entries,
  eventType,
  eventTypes,
  onCursor,
  onEventSelect,
}: Props) => {
  const is24Hours = shouldUse24Hours();
  const organization = useOrganization();
  const hasEntries = entries && entries.length > 0;
  const ipv4Length = 15;

  const eventOptions = eventTypes?.map(type => ({
    label: type,
    value: type,
  }));

  const action = (
    <EventSelector
      clearable
      isDisabled={isLoading}
      name="eventFilter"
      value={eventType}
      placeholder={t('Select Action: ')}
      options={eventOptions}
      onChange={options => {
        onEventSelect(options?.value);
      }}
    />
  );

  return (
    <div>
      <SettingsPageHeader title={t('Audit Log')} action={action} />
      <PanelTable
        headers={[t('Member'), t('Action'), t('IP'), t('Time')]}
        isEmpty={!hasEntries && entries?.length === 0}
        emptyMessage={t('No audit entries available')}
        isLoading={isLoading}
      >
        {entries?.map(entry => {
          return (
            <Fragment key={entry.id}>
              <UserInfo>
                <div>{getAvatarDisplay(entry.actor)}</div>
                <NameContainer>
                  {addUsernameDisplay(entry.actor)}
                  <AuditNote entry={entry} orgSlug={organization.slug} />
                </NameContainer>
              </UserInfo>
              <FlexCenter>
                <MonoDetail>{entry.event}</MonoDetail>
              </FlexCenter>
              <FlexCenter>
                {entry.ipAddress && (
                  <IpAddressOverflow>
                    <Tooltip
                      title={entry.ipAddress}
                      disabled={entry.ipAddress.length <= ipv4Length}
                    >
                      <MonoDetail>{entry.ipAddress}</MonoDetail>
                    </Tooltip>
                  </IpAddressOverflow>
                )}
              </FlexCenter>
              <TimestampInfo>
                <DateTime dateOnly date={entry.dateCreated} />
                <DateTime
                  timeOnly
                  format={is24Hours ? 'HH:mm zz' : 'LT zz'}
                  date={entry.dateCreated}
                />
              </TimestampInfo>
            </Fragment>
          );
        })}
      </PanelTable>
      {pageLinks && <Pagination pageLinks={pageLinks} onCursor={onCursor} />}
    </div>
  );
};

const SentryAvatar = styled(ActivityAvatar)`
  margin-right: ${space(1)};
`;

const Name = styled('strong')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StaffTag = styled(Tag)`
  padding: ${space(1)};
`;

const EventSelector = styled(SelectControl)`
  width: 250px;
`;

const UserInfo = styled('div')`
  display: flex;
  align-items: center;
  line-height: 1.2;
  font-size: ${p => p.theme.fontSizeSmall};
  min-width: 250px;
`;

const NameContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Note = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  word-break: break-word;
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const IpAddressOverflow = styled('div')`
  ${p => p.theme.overflowEllipsis};
  min-width: 90px;
`;

const MonoDetail = styled('code')`
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: no-wrap;
`;

const TimestampInfo = styled('div')`
  display: grid;
  grid-template-rows: auto auto;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default AuditLogList;
