import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconAttachment} from '@sentry/icons/attachment';
import {keepPreviousData} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';

import {t, tct, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';
import {Tab} from 'sentry/views/issueDetails/types';
import {useIssueDetailsLinks} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function AttachmentsBadge({group}: {group: Group}) {
  const links = useIssueDetailsLinks();
  const attachments = useGroupEventAttachments({
    group,
    activeAttachmentsTab: 'all',
    options: {placeholderData: keepPreviousData, fetchAllAvailable: true},
  });

  const attachmentPagination = parseLinkHeader(attachments.pageLinks);

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
        type="button"
        variant="link"
        icon={<IconAttachment size="xs" />}
        to={links.tab(Tab.ATTACHMENTS)}
        replace
        aria-label={t("View this issue's attachments")}
      >
        {hasManyAttachments
          ? tct('[count]+ Attachments', {count: attachments.attachments.length})
          : tn('%s Attachment', '%s Attachments', attachments.attachments.length)}
      </AttachmentButton>
    </Fragment>
  );
}

const AttachmentButton = styled(LinkButton)`
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
