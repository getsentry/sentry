import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {useDeleteEventAttachmentOptimistic} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import FeedbackScreenshot from 'sentry/components/feedback/feedbackItem/feedbackScreenshot';
import OpenScreenshotModal, {
  modalCss,
} from 'sentry/components/feedback/feedbackItem/openScreenshotModal';
import useFeedbackScreenshot from 'sentry/components/feedback/feedbackItem/useFeedbackHasScreenshot';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import {objectIsEmpty} from 'sentry/utils';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
};

export function ScreenshotSection({projectSlug, event, organization}: Props) {
  const {screenshots} = useFeedbackScreenshot({projectSlug, event});
  const hasContext = !objectIsEmpty(event.user ?? {}) || !objectIsEmpty(event.contexts);
  const {mutate: deleteAttachment} = useDeleteEventAttachmentOptimistic();
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
    (eventAttachment: EventAttachment) => {
      openModal(
        modalProps => (
          <OpenScreenshotModal
            {...modalProps}
            event={event}
            orgSlug={organization.slug}
            projectSlug={projectSlug}
            eventAttachment={eventAttachment}
            attachments={screenshots}
            attachmentIndex={screenshotInFocus}
          />
        ),
        {modalCss}
      );
    },
    [event, organization.slug, projectSlug, screenshotInFocus, screenshots]
  );

  if (!hasContext && !screenshots.length) {
    return null;
  }

  const showScreenshot = !!screenshots.length;
  const screenshot = screenshots[screenshotInFocus];

  return showScreenshot ? (
    <ScreenshotWrapper>
      <FeedbackScreenshot
        organization={organization}
        eventId={event.id}
        projectSlug={projectSlug}
        screenshot={screenshot}
        onNext={() => setScreenshotInFocus(screenshotInFocus + 1)}
        onPrevious={() => setScreenshotInFocus(screenshotInFocus - 1)}
        screenshotInFocus={screenshotInFocus}
        totalScreenshots={screenshots.length}
        openVisualizationModal={handleOpenVisualizationModal}
      />
      <Button
        icon={<IconDelete />}
        borderless
        size="xs"
        onClick={() => {
          openConfirmModal({
            header: t('Delete screenshot?'),
            message: t('This action cannot be undone.'),
            confirmText: t('Delete screenshot'),
            onConfirm: () => handleDeleteScreenshot(screenshot.id),
            priority: 'danger',
          });
        }}
        aria-label="delete screenshot"
      />
    </ScreenshotWrapper>
  ) : null;
}

const ScreenshotWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
