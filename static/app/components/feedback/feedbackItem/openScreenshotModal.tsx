import type {ComponentProps} from 'react';
import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import ScreenshotPagination from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotPagination';
import type {CursorHandler} from 'sentry/components/pagination';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventAttachment, IssueAttachment, Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {MAX_SCREENSHOTS_PER_PAGE} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachments';

type Props = ModalRenderProps & {
  eventAttachment: EventAttachment;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  attachmentIndex?: number;
  attachments?: EventAttachment[];
  event?: Event;
  groupId?: string;
  pageLinks?: string | null | undefined;
};

function OpenScreenshotModal({
  eventAttachment,
  orgSlug,
  projectSlug,
  Header,
  Body,
  pageLinks: initialPageLinks,
  attachmentIndex,
  attachments,
  groupId,
}: Props) {
  // copied from issues screenshot modal - handles paginating through multiple screenshots
  const api = useApi();
  const location = useLocation();

  const [currentEventAttachment, setCurrentAttachment] =
    useState<EventAttachment>(eventAttachment);
  const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState<
    number | undefined
  >(attachmentIndex);
  const [memoizedAttachments, setMemoizedAttachments] = useState<
    IssueAttachment[] | undefined
  >(attachments);

  const [pageLinks, setPageLinks] = useState<string | null | undefined>(initialPageLinks);

  const handleCursor: CursorHandler = (cursor, _pathname, query, delta) => {
    if (defined(currentAttachmentIndex) && memoizedAttachments?.length) {
      const newAttachmentIndex = currentAttachmentIndex + delta;
      if (newAttachmentIndex === MAX_SCREENSHOTS_PER_PAGE || newAttachmentIndex === -1) {
        api
          .requestPromise(`/issues/${groupId}/attachments/`, {
            method: 'GET',
            includeAllArgs: true,
            query: {
              ...query,
              per_page: MAX_SCREENSHOTS_PER_PAGE,
              types: undefined,
              screenshot: 1,
              cursor,
            },
          })
          .then(([data, _, resp]) => {
            if (newAttachmentIndex === MAX_SCREENSHOTS_PER_PAGE) {
              setCurrentAttachmentIndex(0);
              setCurrentAttachment(data[0]);
            } else {
              setCurrentAttachmentIndex(MAX_SCREENSHOTS_PER_PAGE - 1);
              setCurrentAttachment(data[MAX_SCREENSHOTS_PER_PAGE - 1]);
            }
            setMemoizedAttachments(data);
            setPageLinks(resp?.getResponseHeader('Link'));
          });
        return;
      }
      setCurrentAttachmentIndex(newAttachmentIndex);
      setCurrentAttachment(memoizedAttachments[newAttachmentIndex]);
    }
  };

  const path = location.pathname;
  const query = location.query;
  const links = pageLinks ? parseLinkHeader(pageLinks) : undefined;

  let paginationProps: ComponentProps<typeof ScreenshotPagination> | null = null;
  if (links) {
    paginationProps = {
      previousDisabled:
        links?.previous?.results === false && currentAttachmentIndex === 0,
      nextDisabled:
        links?.next?.results === false &&
        currentAttachmentIndex === MAX_SCREENSHOTS_PER_PAGE - 1,
      onPrevious: () => {
        handleCursor(links.previous?.cursor, path, query, -1);
      },
      onNext: () => {
        handleCursor(links.next?.cursor, path, query, 1);
      },
    };
  } else if (
    memoizedAttachments &&
    memoizedAttachments.length > 1 &&
    defined(currentAttachmentIndex)
  ) {
    paginationProps = {
      previousDisabled: currentAttachmentIndex === 0,
      nextDisabled: currentAttachmentIndex === memoizedAttachments.length - 1,
      onPrevious: () => {
        setCurrentAttachment(memoizedAttachments[currentAttachmentIndex - 1]);
        setCurrentAttachmentIndex(currentAttachmentIndex - 1);
      },
      onNext: () => {
        setCurrentAttachment(memoizedAttachments[currentAttachmentIndex + 1]);
        setCurrentAttachmentIndex(currentAttachmentIndex + 1);
      },
      headerText: tct('[currentScreenshotIndex] of [totalScreenshotCount]', {
        currentScreenshotIndex: currentAttachmentIndex + 1,
        totalScreenshotCount: memoizedAttachments.length,
      }),
    };
  }

  // end copy from issues screenshot modal

  return (
    <Fragment>
      <StyledHeaderWrapper hasPagination={defined(paginationProps)}>
        <Header closeButton>{t('Screenshot')}</Header>
        {defined(paginationProps) && (
          <Header>
            <ScreenshotPagination {...paginationProps} />
          </Header>
        )}
      </StyledHeaderWrapper>
      <Body>
        <StyledImageVisualization
          attachment={currentEventAttachment}
          orgId={orgSlug}
          projectSlug={projectSlug}
          eventId={currentEventAttachment.event_id}
        />
      </Body>
    </Fragment>
  );
}

export default OpenScreenshotModal;

const StyledHeaderWrapper = styled('div')<{hasPagination: boolean}>`
  ${p =>
    p.hasPagination &&
    `
  header {
    margin-bottom: 0;
  }

  header:last-of-type {
    margin-top: 0;
    margin-bottom: ${space(3)};
  }
  `}
`;

const StyledImageVisualization = styled(ImageVisualization)`
  img {
    border-radius: ${p => p.theme.borderRadius};
    max-height: calc(100vh - 300px);
  }
  background: ${p => p.theme.black};
  border-radius: ${p => p.theme.borderRadius};
`;

export const modalCss = css`
  height: 100%;
  width: 100%;
`;
