import {Fragment} from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'app/components/avatar/userAvatar';
import DateTime from 'app/components/dateTime';
import SelectField from 'app/components/forms/selectField';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {AuditLog} from 'app/types';
import {use24Hours} from 'app/utils/dates';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8,
};

type Props = {
  isLoading: boolean;
  entries: AuditLog[] | null;
  pageLinks: string | null;
  eventType: string;
  eventTypes: string[];
  onEventSelect: (value: string) => void;
};

const AuditLogList = ({
  isLoading,
  pageLinks,
  entries,
  eventType,
  eventTypes,
  onEventSelect,
}: Props) => {
  const is24Hours = use24Hours();
  const hasEntries = entries && entries.length > 0;
  const ipv4Length = 15;
  const options = [
    {value: '', label: t('Any action'), clearableVaue: false},
    ...eventTypes.map(type => ({label: type, value: type, clearableValue: false})),
  ];

  const action = (
    <form>
      <SelectField
        name="event"
        onChange={onEventSelect as SelectField['props']['onChange']}
        value={eventType}
        style={{width: 250}}
        options={options}
      />
    </form>
  );

  return (
    <div>
      <SettingsPageHeader title={t('Audit Log')} action={action} />
      <PanelTable
        headers={[t('Member'), t('Action'), t('IP'), t('Time')]}
        isEmpty={!hasEntries}
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
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </div>
  );
};

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
  ${overflowEllipsis};
  min-width: 90px;
`;

const MonoDetail = styled('code')`
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: no-wrap;
`;

const TimestampInfo = styled('div')`
  display: grid;
  grid-template-rows: auto auto;
  grid-gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default AuditLogList;
