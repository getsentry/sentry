import {ComponentProps, Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Buttonbar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DateTime from 'sentry/components/dateTime';
import {getRelativeTimeFromEventDateCreated} from 'sentry/components/events/contexts/utils';
import Link from 'sentry/components/links/link';
import NotAvailable from 'sentry/components/notAvailable';
import {CursorHandler} from 'sentry/components/pagination';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventAttachment, IssueAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {MAX_SCREENSHOTS_PER_PAGE} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachments';

import ImageVisualization from './imageVisualization';
import ScreenshotPagination from './screenshotPagination';

type Props = ModalRenderProps & {
  downloadUrl: string;
  eventAttachment: EventAttachment;
  onDelete: () => void;
  onDownload: () => void;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  attachmentIndex?: number;
  attachments?: EventAttachment[];
  enablePagination?: boolean;
  event?: Event;
  groupId?: string;
  pageLinks?: string | null | undefined;
};

function Modal({
  eventAttachment,
  orgSlug,
  projectSlug,
  Header,
  Body,
  Footer,
  event,
  onDelete,
  downloadUrl,
  onDownload,
  pageLinks: initialPageLinks,
  attachmentIndex,
  attachments,
  enablePagination,
  groupId,
}: Props) {
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
  const {dateCreated, size, mimetype} = currentEventAttachment;
  const links = pageLinks ? parseLinkHeader(pageLinks) : undefined;

  // Pagination behaviour is different between the attachments tab with page links
  // vs the issue details page where we have all of the screenshots fetched already
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

        <GeneralInfo>
          {groupId && enablePagination && (
            <Fragment>
              <Label>{t('Event ID')}</Label>
              <Value>
                <Title
                  to={`/organizations/${orgSlug}/issues/${groupId}/events/${currentEventAttachment.event_id}/`}
                >
                  {currentEventAttachment.event_id}
                </Title>
              </Value>
            </Fragment>
          )}
          <Label coloredBg>{t('Date Created')}</Label>
          <Value coloredBg>
            {dateCreated ? (
              <Fragment>
                <DateTime
                  date={getDynamicText({
                    value: dateCreated,
                    fixed: new Date(1508208080000),
                  })}
                />
                {event &&
                  getRelativeTimeFromEventDateCreated(
                    event.dateCreated ? event.dateCreated : event.dateReceived,
                    dateCreated,
                    false
                  )}
              </Fragment>
            ) : (
              <NotAvailable />
            )}
          </Value>

          <Label>{t('Size')}</Label>
          <Value>{defined(size) ? formatBytesBase2(size) : <NotAvailable />}</Value>

          <Label coloredBg>{t('MIME Type')}</Label>
          <Value coloredBg>{mimetype ?? <NotAvailable />}</Value>
        </GeneralInfo>
      </Body>
      <Footer>
        <Buttonbar gap={1}>
          <Confirm
            confirmText={t('Delete')}
            header={t(
              'Screenshots help identify what the user saw when the event happened'
            )}
            message={t('Are you sure you wish to delete this screenshot?')}
            priority="danger"
            onConfirm={onDelete}
          >
            <Button priority="danger">{t('Delete')}</Button>
          </Confirm>
          <Button onClick={onDownload} href={downloadUrl}>
            {t('Download')}
          </Button>
        </Buttonbar>
      </Footer>
    </Fragment>
  );
}

export default Modal;

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

const GeneralInfo = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(3)};
`;

const Label = styled('div')<{coloredBg?: boolean}>`
  color: ${p => p.theme.textColor};
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1)};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const Value = styled(Label)`
  white-space: pre-wrap;
  word-break: break-all;
  color: ${p => p.theme.subText};
  padding: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const StyledImageVisualization = styled(ImageVisualization)`
  img {
    border-radius: ${p => p.theme.borderRadius};
    max-height: calc(100vh - 300px);
  }
`;

const Title = styled(Link)`
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

export const modalCss = css`
  width: auto;
  height: 100%;
  max-width: 700px;
`;
