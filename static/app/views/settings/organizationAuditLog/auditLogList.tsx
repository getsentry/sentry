import React from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'app/components/avatar/userAvatar';
import DateTime from 'app/components/dateTime';
import SelectField from 'app/components/forms/selectField';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8,
};

type Props = {
  entries: any[];
  pageLinks: string;
  eventType: string;
  eventTypes: string[];
  onEventSelect: (value: string) => void;
};

const AuditLogList = ({
  pageLinks,
  entries,
  eventType,
  eventTypes,
  onEventSelect,
}: Props) => {
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
      <Panel>
        <StyledPanelHeader disablePadding>
          <div>{t('Member')}</div>
          <div>{t('Action')}</div>
          <div>{t('IP')}</div>
          <div>{t('Time')}</div>
        </StyledPanelHeader>

        <PanelBody>
          {!hasEntries && <EmptyMessage>{t('No audit entries available')}</EmptyMessage>}

          {hasEntries &&
            entries.map(entry => (
              <StyledPanelItem alignItems="center" key={entry.id}>
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
                <div>
                  <MonoDetail>{entry.event}</MonoDetail>
                </div>
                <TimestampOverflow>
                  <Tooltip
                    title={entry.ipAddress}
                    disabled={entry.ipAddress && entry.ipAddress.length <= ipv4Length}
                  >
                    <MonoDetail>{entry.ipAddress}</MonoDetail>
                  </Tooltip>
                </TimestampOverflow>
                <TimestampInfo>
                  <DateTime dateOnly date={entry.dateCreated} />
                  <DateTime timeOnly format="LT zz" date={entry.dateCreated} />
                </TimestampInfo>
              </StyledPanelItem>
            ))}
        </PanelBody>
      </Panel>
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </div>
  );
};

const UserInfo = styled('div')`
  display: flex;
  line-height: 1.2;
  font-size: 13px;
  flex: 1;
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
const TimestampOverflow = styled('div')`
  ${overflowEllipsis};
`;

const MonoDetail = styled('code')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledPanelHeader = styled(PanelHeader)`
  display: grid;
  grid-template-columns: 1fr max-content 130px 150px;
  grid-column-gap: ${space(2)};
  padding: ${space(2)};
`;

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr max-content 130px 150px;
  grid-column-gap: ${space(2)};
  padding: ${space(2)};
`;

const TimestampInfo = styled('div')`
  display: grid;
  grid-template-rows: auto auto;
  grid-gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default AuditLogList;
