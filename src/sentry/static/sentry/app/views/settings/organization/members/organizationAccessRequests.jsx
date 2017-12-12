import React from 'react';
import PropTypes from 'prop-types';
import {Flex, Box} from 'grid-emotion';
import {withTheme} from 'emotion-theming';
import styled from 'react-emotion';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import Panel from '../../components/panel';
import PanelBody from '../../components/panelBody';
import SpreadLayout from '../../../../components/spreadLayout';
import PanelHeader from '../../components/panelHeader';
import SentryTypes from '../../../../proptypes';

const PendingRow = withTheme(styled(SpreadLayout)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
`);

class OrganizationAccessRequests extends React.Component {
  static propTypes = {
    requestList: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        member: SentryTypes.Member,
        team: SentryTypes.Team,
      })
    ),
    accessRequestBusy: PropTypes.object,
    onApprove: PropTypes.func.isRequired,
    onDeny: PropTypes.func.isRequired,
  };

  static defaultProps = {
    requestList: [],
  };

  handleApprove = (id, e) => {
    e.stopPropagation();
    this.props.onApprove(id);
  };

  handleDeny = (id, e) => {
    e.stopPropagation();
    this.props.onDeny(id);
  };

  render() {
    let {accessRequestBusy, requestList} = this.props;

    if (!requestList || !requestList.length) return null;

    return (
      <Panel>
        <PanelHeader disablePadding>
          <Flex>
            <Box px={2} flex="1">
              {t('Pending Access Requests')}
            </Box>
          </Flex>
        </PanelHeader>

        <PanelBody>
          {requestList.map(({id, member, team}, i) => {
            let displayName =
              member.user &&
              (member.user.name || member.user.email || member.user.username);
            return (
              <PendingRow key={id}>
                <Box p={2} flex="1">
                  {tct('[name] requests access to the [team] team.', {
                    name: <strong>{displayName}</strong>,
                    team: <strong>{team.name}</strong>,
                  })}
                </Box>
                <Box p={2}>
                  <Button
                    onClick={e => this.handleApprove(id, e)}
                    busy={accessRequestBusy.get(id)}
                    priority="primary"
                    style={{marginRight: 4}}
                    size="small"
                  >
                    {t('Approve')}
                  </Button>
                  <Button
                    busy={accessRequestBusy.get(id)}
                    onClick={e => this.handleDeny(id, e)}
                    size="small"
                  >
                    {t('Deny')}
                  </Button>
                </Box>
              </PendingRow>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

export default OrganizationAccessRequests;
