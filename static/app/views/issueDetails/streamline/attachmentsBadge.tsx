import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import useDrawer from 'sentry/components/globalDrawer';
import {IconAttachment} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {Divider} from 'sentry/views/issueDetails/divider';
import {GroupEventAttachmentsDrawer} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsDrawer';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';

export function AttachmentsBadge({group, project}: {group: Group; project: Project}) {
  const {openDrawer} = useDrawer();
  const attachments = useGroupEventAttachments({
    groupId: group.id,
    activeAttachmentsTab: 'all',
  });
  const attachmentPagination = parseLinkHeader(
    attachments.getResponseHeader?.('Link') ?? null
  );

  const hasAttachments =
    attachmentPagination.next?.results || attachments.attachments.length > 0;

  if (!hasAttachments) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <AttachmentButton
        type="button"
        priority="link"
        size="zero"
        icon={<IconAttachment size="xs" />}
        onClick={() => {
          openDrawer(
            () => <GroupEventAttachmentsDrawer project={project} groupId={group.id} />,
            {
              ariaLabel: 'breadcrumb drawer',
            }
          );
        }}
      >
        {t(
          '%s Attachments',
          attachmentPagination.next?.results ? '50+' : attachments.attachments.length
        )}
      </AttachmentButton>
    </Fragment>
  );
}

const AttachmentButton = styled(Button)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
