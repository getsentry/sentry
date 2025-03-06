import type {ComponentProps} from 'react';
import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {Flex} from 'sentry/components/container/flex';
import {DateTime} from 'sentry/components/dateTime';
import KeyValueData from 'sentry/components/keyValueData';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';

import ImageVisualization from './imageVisualization';
import ScreenshotPagination from './screenshotPagination';

export const MAX_SCREENSHOTS_PER_PAGE = 20;

interface ScreenshotModalProps extends ModalRenderProps {
  downloadUrl: string;
  eventAttachment: EventAttachment;
  projectSlug: Project['slug'];
  /**
   * Enables pagination of screenshots.
   */
  attachments?: EventAttachment[];
  /**
   * Enables navigation to the issue details page.
   */
  groupId?: string;
  onDelete?: () => void;
  onDownload?: () => void;
}

export default function ScreenshotModal({
  eventAttachment,
  attachments = [],
  projectSlug,
  Header,
  Body,
  Footer,
  onDelete,
  downloadUrl,
  onDownload,
  groupId,
}: ScreenshotModalProps) {
  const organization = useOrganization();

  const [currentEventAttachment, setCurrentAttachment] =
    useState<EventAttachment>(eventAttachment);

  const currentAttachmentIndex = attachments.findIndex(
    attachment => attachment.id === currentEventAttachment.id
  );
  const paginateItems = useCallback(
    (delta: number) => {
      if (attachments.length) {
        const newIndex = currentAttachmentIndex + delta;
        if (newIndex >= 0 && newIndex < attachments.length) {
          setCurrentAttachment(attachments[newIndex]!);
        }
      }
    },
    [attachments, currentAttachmentIndex]
  );

  const paginateHotkeys = useMemo(() => {
    return [
      {match: 'right', callback: () => paginateItems(1)},
      {match: 'left', callback: () => paginateItems(-1)},
    ];
  }, [paginateItems]);
  useHotkeys(paginateHotkeys);

  const {dateCreated, size, mimetype} = currentEventAttachment;

  let paginationProps: ComponentProps<typeof ScreenshotPagination> | null = null;
  if (attachments.length > 1 && defined(currentAttachmentIndex)) {
    paginationProps = {
      previousDisabled: currentAttachmentIndex === 0,
      nextDisabled: currentAttachmentIndex === attachments.length - 1,
      onPrevious: () => {
        paginateItems(-1);
      },
      onNext: () => {
        paginateItems(1);
      },
      headerText: tct('[currentScreenshotIndex] of [totalScreenshotCount]', {
        currentScreenshotIndex: currentAttachmentIndex + 1,
        totalScreenshotCount: attachments.length,
      }),
    };
  }

  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Screenshot')}</h5>
      </Header>
      <Body>
        <Flex column gap={space(1.5)}>
          {defined(paginationProps) && <ScreenshotPagination {...paginationProps} />}
          <StyledImageVisualization
            attachment={currentEventAttachment}
            orgSlug={organization.slug}
            projectSlug={projectSlug}
            eventId={currentEventAttachment.event_id}
          />
          <KeyValueData.Card
            title={eventAttachment.name}
            contentItems={[
              {
                item: {
                  key: 'event',
                  subject: t('Event ID'),
                  value: currentEventAttachment.event_id,
                  action: groupId
                    ? {
                        link: `/organizations/${organization.slug}/issues/${groupId}/events/${currentEventAttachment.event_id}/`,
                      }
                    : undefined,
                },
              },
              {
                item: {
                  key: 'date',
                  subject: t('Date Created'),
                  value: <DateTime date={dateCreated} />,
                },
              },
              {
                item: {key: 'size', subject: t('Size'), value: formatBytesBase2(size)},
              },
              {
                item: {
                  key: 'mimetype',
                  subject: t('MIME Type'),
                  value: mimetype,
                },
              },
            ]}
          />
        </Flex>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          {onDelete && (
            <Confirm
              confirmText={t('Delete')}
              message={<h6>{t('Are you sure you want to delete this screenshot?')}</h6>}
              priority="danger"
              onConfirm={onDelete}
            >
              <Button priority="danger">{t('Delete')}</Button>
            </Confirm>
          )}
          <LinkButton onClick={onDownload} href={downloadUrl}>
            {t('Download')}
          </LinkButton>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

const StyledImageVisualization = styled(ImageVisualization)`
  border-bottom: 0;
  img {
    max-height: calc(100vh - 300px);
  }
`;

export const modalCss = css`
  width: auto;
  height: 100%;
  max-width: 700px;
  margin-top: 0 !important;
`;
