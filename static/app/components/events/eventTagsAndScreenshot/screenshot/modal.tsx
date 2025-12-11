import type {ComponentProps} from 'react';
import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import ImageViewer from 'sentry/components/events/attachmentViewers/imageViewer';
import {getImageAttachmentRenderer} from 'sentry/components/events/attachmentViewers/previewAttachmentTypes';
import {KeyValueData} from 'sentry/components/keyValueData';
import {t, tct} from 'sentry/locale';
import type {EventAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';

import ScreenshotPagination from './screenshotPagination';

interface ScreenshotModalProps extends ModalRenderProps {
  downloadUrl: string;
  /**
   * The target screenshot attachment to show.
   */
  eventAttachment: EventAttachment;
  projectSlug: Project['slug'];
  /**
   * All attachments to enable pagination, will be filtered to image
   * attachments automatically.
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

  const screenshots = attachments.filter(({name}) => name.includes('screenshot'));

  const [currentEventAttachment, setCurrentAttachment] =
    useState<EventAttachment>(eventAttachment);

  const currentAttachmentIndex = screenshots.findIndex(
    attachment => attachment.id === currentEventAttachment.id
  );
  const paginateItems = (delta: number) => {
    if (screenshots.length) {
      const newIndex = currentAttachmentIndex + delta;
      if (newIndex >= 0 && newIndex < screenshots.length) {
        setCurrentAttachment(screenshots[newIndex]!);
      }
    }
  };

  useHotkeys([
    {match: 'right', callback: () => paginateItems(1)},
    {match: 'left', callback: () => paginateItems(-1)},
  ]);

  const {dateCreated, size, mimetype} = currentEventAttachment;

  let paginationProps: ComponentProps<typeof ScreenshotPagination> | null = null;
  if (screenshots.length > 1 && defined(currentAttachmentIndex)) {
    paginationProps = {
      previousDisabled: currentAttachmentIndex === 0,
      nextDisabled: currentAttachmentIndex === screenshots.length - 1,
      onPrevious: () => {
        paginateItems(-1);
      },
      onNext: () => {
        paginateItems(1);
      },
      headerText: tct('[currentScreenshotIndex] of [totalScreenshotCount]', {
        currentScreenshotIndex: currentAttachmentIndex + 1,
        totalScreenshotCount: screenshots.length,
      }),
    };
  }

  const AttachmentComponent =
    getImageAttachmentRenderer(currentEventAttachment) ?? ImageViewer;

  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Screenshot')}</h5>
      </Header>
      <Body>
        <Flex direction="column" gap="lg">
          {defined(paginationProps) && <ScreenshotPagination {...paginationProps} />}
          <AttachmentComponentWrapper>
            <AttachmentComponent
              attachment={currentEventAttachment}
              orgSlug={organization.slug}
              projectSlug={projectSlug}
              eventId={currentEventAttachment.event_id}
            />
          </AttachmentComponentWrapper>
          <KeyValueData.Card
            title={currentEventAttachment.name}
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
        <ButtonBar>
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

const AttachmentComponentWrapper = styled('div')`
  & > img,
  & > video {
    max-width: 100%;
    max-height: calc(100vh - 300px);
    width: 100%;
    height: auto;
    object-fit: contain;
    border-radius: ${p => p.theme.radius.md};
  }
`;

export const modalCss = css`
  width: auto;
  height: 100%;
  max-width: min(90vw, 1500px);
  margin-top: 0 !important;
`;
