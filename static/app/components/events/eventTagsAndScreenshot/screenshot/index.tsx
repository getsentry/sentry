import type {ReactEventHandler} from 'react';
import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {useRole} from 'sentry/components/acl/useRole';
import {openConfirmModal} from 'sentry/components/confirm';
import {ImageViewer} from 'sentry/components/events/attachmentViewers/imageViewer';
import {
  imageMimeTypes,
  webmMimeTypes,
} from 'sentry/components/events/attachmentViewers/previewAttachmentTypes';
import {VideoViewer} from 'sentry/components/events/attachmentViewers/videoViewer';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconChevron, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {PanelProvider} from 'sentry/utils/panelProvider';

type Props = {
  eventId: Event['id'];
  onDelete: (attachmentId: EventAttachment['id']) => void;
  openVisualizationModal: (eventAttachment: EventAttachment, downloadUrl: string) => void;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
  screenshotInFocus: number;
  totalScreenshots: number;
  onNext?: ReactEventHandler;
  onPrevious?: ReactEventHandler;
};

export function Screenshot({
  eventId,
  organization,
  screenshot,
  screenshotInFocus,
  onNext,
  onPrevious,
  totalScreenshots,
  projectSlug,
  onDelete,
  openVisualizationModal,
}: Props) {
  const [loadingImage, setLoadingImage] = useState(
    imageMimeTypes.includes(screenshot.mimetype) ||
      webmMimeTypes.includes(screenshot.mimetype)
  );

  const {hasRole} = useRole({role: 'attachmentsRole'});
  if (!hasRole) {
    return null;
  }

  function handleDelete(screenshotAttachmentId: string) {
    trackAnalytics('issue_details.issue_tab.screenshot_dropdown_deleted', {
      organization,
    });
    onDelete(screenshotAttachmentId);
  }

  const AttachmentComponent = webmMimeTypes.includes(screenshot.mimetype)
    ? VideoViewer
    : ImageViewer;
  const downloadUrl = `/api/0/projects/${organization.slug}/${projectSlug}/events/${eventId}/attachments/${screenshot.id}/`;

  return (
    <Container width="100%" maxWidth={{zero: '100%', xl: '175px'}} height="100%">
      <PanelProvider>
        <Container height="100%" background="primary" radius="md">
          <Stack justify="center" align="center" height="100%">
            {totalScreenshots > 1 && (
              <Flex
                align="center"
                justify="between"
                padding="md"
                width="100%"
                border="primary"
                borderBottom="none"
                radius="md md 0 0"
                background="primary"
              >
                <Button
                  disabled={screenshotInFocus === 0}
                  aria-label={t('Previous Screenshot')}
                  onClick={onPrevious}
                  icon={<IconChevron direction="left" />}
                  size="xs"
                />
                <Text as="span" size="sm" variant="secondary" density="compressed">
                  {tct('[currentScreenshot] of [totalScreenshots]', {
                    currentScreenshot: screenshotInFocus + 1,
                    totalScreenshots,
                  })}
                </Text>
                <Button
                  disabled={screenshotInFocus + 1 === totalScreenshots}
                  aria-label={t('Next Screenshot')}
                  onClick={onNext}
                  icon={<IconChevron direction="right" />}
                  size="xs"
                />
              </Flex>
            )}
            <Stack
              align="center"
              justify="center"
              flex={1}
              width="100%"
              minHeight="48px"
              overflow="hidden"
              position="relative"
              border="primary"
              radius={totalScreenshots > 1 ? undefined : 'md md 0 0'}
            >
              {loadingImage && (
                <Flex justify="center" align="center" height="100%" position="absolute">
                  <LoadingIndicator mini />
                </Flex>
              )}
              <Container
                cursor="pointer"
                onClick={() =>
                  openVisualizationModal(screenshot, `${downloadUrl}?download=1`)
                }
              >
                <Container width="100%" border="none" padding="0">
                  {containerProps => (
                    <AttachmentComponent
                      {...containerProps}
                      orgSlug={organization.slug}
                      projectSlug={projectSlug}
                      eventId={eventId}
                      attachment={screenshot}
                      onLoad={() => setLoadingImage(false)}
                      onError={() => setLoadingImage(false)}
                      controls={false}
                      onCanPlay={() => setLoadingImage(false)}
                    />
                  )}
                </Container>
              </Container>
            </Stack>
            <Container
              padding="md"
              width="100%"
              border="primary"
              borderTop="none"
              radius="0 0 md md"
            >
              <Grid flow="column" align="center" gap="md">
                <Button
                  size="xs"
                  onClick={() =>
                    openVisualizationModal(screenshot, `${downloadUrl}?download=1`)
                  }
                >
                  {t('View screenshot')}
                </Button>
                <DropdownMenu
                  position="bottom"
                  offset={4}
                  trigger={triggerProps => (
                    <OverlayTrigger.IconButton
                      {...triggerProps}
                      icon={<IconEllipsis />}
                      aria-label={t('More screenshot actions')}
                    />
                  )}
                  size="xs"
                  items={[
                    {
                      key: 'download',
                      label: t('Download'),
                      onAction: () => {
                        window.location.assign(`${downloadUrl}?download=1`);
                        trackAnalytics(
                          'issue_details.issue_tab.screenshot_dropdown_download',
                          {
                            organization,
                          }
                        );
                      },
                    },
                    {
                      key: 'delete',
                      label: t('Delete'),
                      onAction: () =>
                        openConfirmModal({
                          header: t('Delete this image?'),
                          message: t(
                            'This image was captured around the time that the event occurred. Are you sure you want to delete this image?'
                          ),
                          onConfirm: () => handleDelete(screenshot.id),
                        }),
                    },
                  ]}
                />
              </Grid>
            </Container>
          </Stack>
        </Container>
      </PanelProvider>
    </Container>
  );
}
