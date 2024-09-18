import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconAttachment} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {keepPreviousData} from 'sentry/utils/queryClient';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';
import {useGroupEventAttachmentsDrawer} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachmentsDrawer';

export function AttachmentsBadge({group, project}: {group: Group; project: Project}) {
  const attachments = useGroupEventAttachments({
    groupId: group.id,
    activeAttachmentsTab: 'all',
    options: {placeholderData: keepPreviousData},
  });
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {openAttachmentDrawer} = useGroupEventAttachmentsDrawer({
    project,
    group,
    openButtonRef,
  });

  const attachmentPagination = parseLinkHeader(
    attachments.getResponseHeader?.('Link') ?? null
  );

  // Since we reuse whatever page the user was on, we can look at pagination to determine if there are more attachments
  const hasManyAttachments =
    attachmentPagination.next?.results || attachmentPagination.previous?.results;

  if (!attachments.attachments.length && !hasManyAttachments) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <AttachmentButton
        ref={openButtonRef}
        type="button"
        priority="link"
        size="zero"
        icon={<IconAttachment size="xs" />}
        onClick={() => {
          openAttachmentDrawer();
        }}
      >
        {hasManyAttachments
          ? t('50+ Attachments')
          : tn('%s Attachment', '%s Attachments', attachments.attachments.length)}
      </AttachmentButton>
    </Fragment>
  );
}

const AttachmentButton = styled(Button)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
