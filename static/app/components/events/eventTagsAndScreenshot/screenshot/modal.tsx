import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import Buttonbar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DateTime from 'sentry/components/dateTime';
import {getRelativeTimeFromEventDateCreated} from 'sentry/components/events/contexts/utils';
import NotAvailable from 'sentry/components/notAvailable';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventAttachment, IssueAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';

import ImageVisualization from './imageVisualization';

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
}: Props) {
  const api = useApi();

  const [currentEventAttachment, setCurrentAttachment] =
    useState<EventAttachment>(eventAttachment);
  const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState<
    number | undefined
  >(attachmentIndex);
  const [memoizedAttachments, setMemoizedAttachments] = useState<
    IssueAttachment[] | undefined
  >(attachments);

  const [pageLinks, setPageLinks] = useState<string | null | undefined>(initialPageLinks);

  const handleCursor: CursorHandler = (cursor, pathname, query, delta) => {
    if (defined(currentAttachmentIndex) && memoizedAttachments?.length) {
      const newAttachmentIndex = currentAttachmentIndex + delta;
      if (newAttachmentIndex > 5 || newAttachmentIndex < 0) {
        api
          .requestPromise(pathname, {
            method: 'GET',
            includeAllArgs: true,
            query: {
              ...query,
              per_page: 6,
              types: undefined,
              screenshot: 1,
              cursor,
            },
          })
          .then(([data, _, resp]) => {
            setMemoizedAttachments(data);
            setCurrentAttachmentIndex(0);
            setCurrentAttachment(data[0]);
            setPageLinks(resp?.getResponseHeader('Link'));
          });
        return;
      }
      setCurrentAttachmentIndex(newAttachmentIndex);
      setCurrentAttachment(memoizedAttachments[newAttachmentIndex]);
    }
  };

  const {dateCreated, size, mimetype} = currentEventAttachment;

  return (
    <Fragment>
      <Header closeButton>{t('Screenshot')}</Header>
      <Body>
        <GeralInfo>
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
        </GeralInfo>

        <StyledImageVisualization
          attachment={currentEventAttachment}
          orgId={orgSlug}
          projectId={projectSlug}
          eventId={currentEventAttachment.event_id}
        />
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
          {enablePagination && (
            <StyledPagination onCursor={handleCursor} pageLinks={pageLinks} />
          )}
        </Buttonbar>
      </Footer>
    </Fragment>
  );
}

export default Modal;

const GeralInfo = styled('div')`
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
  }
`;

export const modalCss = css`
  width: auto;
  height: 100%;
  max-width: 700px;
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;
