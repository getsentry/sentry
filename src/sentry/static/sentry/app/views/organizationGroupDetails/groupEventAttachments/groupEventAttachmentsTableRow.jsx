import PropTypes from 'prop-types';
import React from 'react';

// import AttachmentUrl from 'app/utils/attachmentUrl';
// import Avatar from 'app/components/avatar';
// import DateTime from 'app/components/dateTime';
// import DeviceName from 'app/components/deviceName';
import FileSize from 'app/components/fileSize';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class GroupEventAttachmentsTableRow extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    // projectId: PropTypes.string,
    attachment: SentryTypes.EventAttachment,
  };

  //   renderCrashFileLink() {
  //     const {attachment, projectId} = this.props;
  //     if (!event.crashFile) {
  //       return null;
  //     }

  //     const crashFileType =
  //       event.crashFile.type === 'event.minidump' ? 'Minidump' : 'Crash file';

  //     return (
  //       <AttachmentUrl projectId={projectId} event={event} attachment={event.crashFile}>
  //         {downloadUrl =>
  //           downloadUrl && (
  //             <small>
  //               {crashFileType}: <a href={downloadUrl}>{event.crashFile.name}</a> (
  //               <FileSize bytes={event.crashFile.size} />)
  //             </small>
  //           )
  //         }
  //       </AttachmentUrl>
  //     );
  //   }

  // <small>{attachment.title.substr(0, 100)}</small>
  // {this.renderCrashFileLink()}

  render() {
    const {attachment, orgId, groupId} = this.props;
    const link = `/organizations/${orgId}/issues/${groupId}/events/${event.id}/`;

    return (
      <tr>
        <td>
          <h5>
            <GlobalSelectionLink to={link}>{attachment.name}</GlobalSelectionLink>
          </h5>
        </td>

        <td>{attachment.type}</td>

        <td>
          <FileSize bytes={attachment.size} />
        </td>

        <td>Download</td>
      </tr>
    );
  }
}

export {GroupEventAttachmentsTableRow};
export default withOrganization(GroupEventAttachmentsTableRow);
