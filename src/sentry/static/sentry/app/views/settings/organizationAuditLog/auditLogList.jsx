import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Avatar from 'app/components/avatar';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SelectField from 'app/components/forms/selectField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';

const UserInfo = styled(Box)`
  display: flex;
  line-height: 1.2;
  font-size: 13px;
  flex: 1;
`;

const NameContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Name = styled.div`
  font-weight: 600;
  font-size: 15px;
`;
const Note = styled.div`
  font-size: 13px;
`;
const OverflowBox = styled.div`
  ${overflowEllipsis};
`;
const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8,
};

class AuditLogList extends React.Component {
  static propTypes = {
    entries: PropTypes.array,
    pageLinks: PropTypes.string,
    eventType: PropTypes.string,
    eventTypes: PropTypes.arrayOf(PropTypes.string),
    onEventSelect: PropTypes.func,
  };

  render() {
    const {pageLinks, entries, eventType, eventTypes, onEventSelect} = this.props;
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
          onChange={onEventSelect}
          value={eventType}
          style={{width: 250}}
          options={options}
          clearable={false}
        />
      </form>
    );

    return (
      <div>
        <SettingsPageHeader title={t('Audit Log')} action={action} />

        <Panel>
          <PanelHeader disablePadding>
            <Box flex="1" pl={2}>
              {t('Member')}
            </Box>
            <Box w={150}>{t('Action')}</Box>
            <Box w={130}>{t('IP')}</Box>
            <Box w={150} px={1}>
              {t('Time')}
            </Box>
          </PanelHeader>

          <PanelBody>
            {!hasEntries && (
              <EmptyMessage>{t('No audit entries available')}</EmptyMessage>
            )}

            {hasEntries &&
              entries.map(entry => {
                return (
                  <PanelItem p={0} align="center" key={entry.id}>
                    <UserInfo flex="1" p={2}>
                      <div>
                        {entry.actor.email && (
                          <Avatar style={avatarStyle} user={entry.actor} />
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
                    <Box w={150}>{entry.event}</Box>
                    <Box w={130}>
                      <Tooltip
                        title={entry.ipAddress}
                        disabled={entry.ipAddress && entry.ipAddress.length <= ipv4Length}
                      >
                        <OverflowBox>{entry.ipAddress}</OverflowBox>
                      </Tooltip>
                    </Box>
                    <Box w={150} p={1}>
                      <DateTime date={entry.dateCreated} />
                    </Box>
                  </PanelItem>
                );
              })}
          </PanelBody>
        </Panel>

        {pageLinks && <Pagination pageLinks={pageLinks} {...this.props} />}
      </div>
    );
  }
}

export default AuditLogList;
