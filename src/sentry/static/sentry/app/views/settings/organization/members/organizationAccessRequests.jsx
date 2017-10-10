import React from 'react';
import PropTypes from 'prop-types';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import SentryTypes from '../../../../proptypes';

class OrganizationAccessRequests extends React.Component {
  static propTypes = {
    requestList: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        member: SentryTypes.Member,
        team: SentryTypes.Team
      })
    ),
    accessRequestBusy: PropTypes.object,
    onApprove: PropTypes.func.isRequired,
    onDeny: PropTypes.func.isRequired
  };

  static defaultProps = {
    requestList: []
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
      <div className="panel panel-default horizontal-scroll">
        <table className="table" id="access_request_list">
          <thead>
            <tr>
              <th colSpan="2">{t('Pending Access Requests')}</th>
            </tr>
          </thead>

          <tbody>
            {requestList.map(({id, member, team}, i) => {
              let displayName =
                member.user &&
                (member.user.name || member.user.email || member.user.username);
              return (
                <tr key={i}>
                  <td>
                    {tct('[name] requests access to the [team] team.', {
                      name: <strong>{displayName}</strong>,
                      team: <strong>{team.name}</strong>
                    })}
                  </td>
                  <td className="align-right">
                    <Button
                      onClick={e => this.handleApprove(id, e)}
                      busy={accessRequestBusy.get(id)}
                      priority="primary"
                      style={{marginRight: 4}}
                      size="small">
                      {t('Approve')}
                    </Button>
                    <Button
                      busy={accessRequestBusy.get(id)}
                      onClick={e => this.handleDeny(id, e)}
                      size="small">
                      {t('Deny')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}

export default OrganizationAccessRequests;
