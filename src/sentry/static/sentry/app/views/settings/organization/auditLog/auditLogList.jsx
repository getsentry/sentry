import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../../locale';
import Avatar from '../../../../components/avatar';
import DateTime from '../../../../components/dateTime';
import Pagination from '../../../../components/pagination';
import Panel from '../../components/panel';
import PanelBody from '../../components/panelBody';
import PanelHeader from '../../components/panelHeader';
import SelectInput from '../../../../components/selectInput';
import SettingsPageHeader from '../../components/settingsPageHeader';
import SpreadLayout from '../../../../components/spreadLayout';

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
const Note = styled.div`font-size: 13px;`;

const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8,
};

const Row = styled.div`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  align-items: center;

  &:last-child {
    border: 0;
  }
`;

class AuditLogList extends React.Component {
  static propTypes = {
    entries: PropTypes.array,
    pageLinks: PropTypes.string,
    eventType: PropTypes.string,
    eventTypes: PropTypes.arrayOf(PropTypes.string),
    onEventSelect: PropTypes.func,
  };

  render() {
    let {pageLinks, entries, eventType, eventTypes, onEventSelect} = this.props;
    let hasEntries = entries && entries.length > 0;

    return (
      <div>
        <SettingsPageHeader label={t('Audit Log')} />

        <SpreadLayout>
          <p>{t('Sentry keeps track of important events within your organization.')}</p>

          <form className="form-horizontal" style={{marginBottom: 20}}>
            <div className="control-group">
              <div className="controls">
                <SelectInput
                  name="event"
                  onChange={onEventSelect}
                  value={eventType}
                  style={{width: 250}}
                >
                  <option key="any" value="">
                    {t('Any')}
                  </option>
                  {eventTypes.map(type => {
                    return <option key={type}>{type}</option>;
                  })}
                </SelectInput>
              </div>
            </div>
          </form>
        </SpreadLayout>

        <Panel>
          <PanelHeader disablePadding>
            <Flex align="center">
              <Box flex="1" pl={1}>
                {t('Member')}
              </Box>
              <Box w={150}>{t('Action')}</Box>
              <Box w={130}>{t('IP')}</Box>
              <Box w={150} px={1}>
                {t('Time')}
              </Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {!hasEntries && <div>{t('No results found.')}</div>}

            {hasEntries &&
              entries.map(entry => {
                return (
                  <Row key={entry.id}>
                    <UserInfo flex="1" p={1}>
                      <div>
                        {entry.actor.email && (
                          <Avatar style={avatarStyle} user={entry.actor} />
                        )}
                      </div>
                      <NameContainer>
                        <Name>{entry.actor.name}</Name>
                        <Note>{entry.note}</Note>
                      </NameContainer>
                    </UserInfo>
                    <Box w={150}>{entry.event}</Box>
                    <Box w={130}>{entry.ipAddress}</Box>
                    <Box w={150} p={1}>
                      <DateTime date={entry.dateCreated} />
                    </Box>
                  </Row>
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
