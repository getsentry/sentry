import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {IconAttachment} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {keepPreviousData} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function AttachmentsBadge({group}: {group: Group}) {
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();
  const attachments = useGroupEventAttachments({
    group,
    activeAttachmentsTab: 'all',
    options: {placeholderData: keepPreviousData, fetchAllAvailable: true},
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
        type="button"
        priority="link"
        size="zero"
        icon={<IconAttachment size="xs" />}
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.ATTACHMENTS]}`,
          query: location.query,
          replace: true,
        }}
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
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
