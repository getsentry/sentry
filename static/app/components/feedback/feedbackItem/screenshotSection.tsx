import {useState} from 'react';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import {objectIsEmpty} from 'sentry/utils';

import Screenshot from '../../events/eventTagsAndScreenshot/screenshot';
import Modal, {modalCss} from '../../events/eventTagsAndScreenshot/screenshot/modal';

const SCREENSHOT_NAMES = [
  'screenshot.jpg',
  'screenshot.png',
  'screenshot-1.jpg',
  'screenshot-1.png',
  'screenshot-2.jpg',
  'screenshot-2.png',
];

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  isShare?: boolean;
};

export function ScreenshotSection({
  projectSlug,
  event,
  organization,
  isShare = false,
}: Props) {
  const hasContext = !objectIsEmpty(event.user ?? {}) || !objectIsEmpty(event.contexts);
  const {data: attachments} = useFetchEventAttachments(
    {
      orgSlug: organization.slug,
      projectSlug,
      eventId: event.id,
    },
    {enabled: !isShare}
  );
  const {mutate: deleteAttachment} = useDeleteEventAttachmentOptimistic();
  const screenshots =
    attachments?.filter(({name}) => SCREENSHOT_NAMES.includes(name)) ?? [];

  const [screenshotInFocus, setScreenshotInFocus] = useState<number>(0);

  if (!hasContext && (isShare || !screenshots.length)) {
    return null;
  }

  const showScreenshot = !isShare && !!screenshots.length;
  const screenshot = screenshots[screenshotInFocus];

  const handleDeleteScreenshot = (attachmentId: string) => {
    deleteAttachment({
      orgSlug: organization.slug,
      projectSlug,
      eventId: event.id,
      attachmentId,
    });
  };

  function handleOpenVisualizationModal(
    eventAttachment: EventAttachment,
    downloadUrl: string
  ) {
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
  }

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
