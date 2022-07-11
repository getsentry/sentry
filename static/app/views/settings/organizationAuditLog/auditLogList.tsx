import {Fragment} from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import DateTime from 'sentry/components/dateTime';
import SelectControl from 'sentry/components/forms/selectControl';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AuditLog} from 'sentry/types';
import {shouldUse24Hours} from 'sentry/utils/dates';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8,
};

type Props = {
  entries: AuditLog[] | null;
  eventType: string | undefined;
  eventTypes: string[];
  isLoading: boolean;
  onCursor: CursorHandler | undefined;
  onEventSelect: (value: string) => void;
  pageLinks: string | null;
};

const AuditLogList = ({
  isLoading,
  pageLinks,
  entries,
  eventTypes,
  onCursor,
  onEventSelect,
}: Props) => {
  const is24Hours = shouldUse24Hours();
  const hasEntries = entries && entries.length > 0;
  const ipv4Length = 15;

  const eventOptions = eventTypes.map(type => ({
    label: type,
    value: type,
  }));

  const action = (
    <EventSelector
      clearable
      isDisabled={isLoading}
      name="eventFilter"
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
        {entries?.map(entry => (
          <Fragment key={entry.id}>
            <UserInfo>
              <div>
                {entry.actor.email && (
                  <UserAvatar style={avatarStyle} user={entry.actor} />
                )}
              </div>
              <NameContainer>
                <Name data-test-id="actor-name">
                  {entry.actor.isSuperuser
                    ? t('%s (Sentry Staff)', entry.actor.name)
                    : entry.actor.name}
                </Name>
                <Note>{entry.note}</Note>
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
        ))}
      </PanelTable>
      {pageLinks && <Pagination pageLinks={pageLinks} onCursor={onCursor} />}
    </div>
  );
};

const EventSelector = styled(SelectControl)`
  width: 250px;
`;

const UserInfo = styled('div')`
  display: flex;
  align-items: center;
  line-height: 1.2;
  font-size: 13px;
  min-width: 250px;
`;

const NameContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Name = styled('div')`
  font-weight: 600;
  font-size: 15px;
`;

const Note = styled('div')`
  font-size: 13px;
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
