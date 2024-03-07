import {useCallback, useMemo, useState} from 'react';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import Screenshot from 'sentry/components/events/eventTagsAndScreenshot/screenshot';
import Modal, {
  modalCss,
} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import {objectIsEmpty} from 'sentry/utils';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  isShare?: boolean;
};

export function ScreenshotSection({projectSlug, event, organization}: Props) {
  const hasContext = !objectIsEmpty(event.user ?? {}) || !objectIsEmpty(event.contexts);
  const {data: attachments} = useFetchEventAttachments({
    orgSlug: organization.slug,
    projectSlug,
    eventId: event.id,
  });
  const {mutate: deleteAttachment} = useDeleteEventAttachmentOptimistic();
  const screenshots = useMemo(() => {
    return attachments ?? [];
  }, [attachments]);

  const [screenshotInFocus, setScreenshotInFocus] = useState<number>(0);

  const handleDeleteScreenshot = useCallback(
    (attachmentId: string) => {
      deleteAttachment({
        orgSlug: organization.slug,
        projectSlug,
        eventId: event.id,
        attachmentId,
      });
    },
    [deleteAttachment, event.id, organization.slug, projectSlug]
  );

  const handleOpenVisualizationModal = useCallback(
    (eventAttachment: EventAttachment, downloadUrl: string) => {
      function handleDelete() {
        handleDeleteScreenshot(eventAttachment.id);
      }

      openModal(
        modalProps => (
          <Modal
            {...modalProps}
            event={event}
            orgSlug={organization.slug}
            projectSlug={projectSlug}
            eventAttachment={eventAttachment}
            downloadUrl={downloadUrl}
            onDelete={handleDelete}
            onDownload={() => undefined}
            attachments={screenshots}
            attachmentIndex={screenshotInFocus}
          />
        ),
        {modalCss}
      );
    },
    [
      event,
      handleDeleteScreenshot,
      organization.slug,
      projectSlug,
      screenshotInFocus,
      screenshots,
    ]
  );

  if (!hasContext && !screenshots.length) {
    return null;
  }

  const showScreenshot = !!screenshots.length;
  const screenshot = screenshots[screenshotInFocus];

  return showScreenshot ? (
    <Section title={t('Screenshot')}>
      <Screenshot
        organization={organization}
        eventId={event.id}
        projectSlug={projectSlug}
        screenshot={screenshot}
        onDelete={handleDeleteScreenshot}
        onNext={() => setScreenshotInFocus(screenshotInFocus + 1)}
        onPrevious={() => setScreenshotInFocus(screenshotInFocus - 1)}
        screenshotInFocus={screenshotInFocus}
        totalScreenshots={screenshots.length}
        openVisualizationModal={handleOpenVisualizationModal}
      />
    </Section>
  ) : null;
}
