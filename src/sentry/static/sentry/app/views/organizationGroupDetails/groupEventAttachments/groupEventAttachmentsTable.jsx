import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import CustomPropTypes from 'app/sentryTypes';
import GroupEventAttachmentsTableRow from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTableRow';

class GroupEventAttachmentsTable extends React.Component {
  static propTypes = {
    attachments: PropTypes.arrayOf(CustomPropTypes.EventAttachment),
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
  };

  render() {
    const {attachments, orgId, projectId, groupId} = this.props;
    const tableRowNames = [t('Name'), t('Type'), t('Size'), t('Actions')];

    return (
      <table className="table events-table">
        <thead>
          <tr>
            {tableRowNames.map(name => {
              return <th key={name}>{name}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {attachments.map(attachment => {
            return (
              <GroupEventAttachmentsTableRow
                key={attachment.id}
                attachment={attachment}
                orgId={orgId}
                projectId={projectId}
                groupId={groupId}
              />
            );
          })}
        </tbody>
      </table>
    );
  }
}

export default GroupEventAttachmentsTable;
