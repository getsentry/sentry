import styled from '@emotion/styled';

import {useDeleteEventAttachmentOptimistic} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import FeedbackScreenshot from 'sentry/components/feedback/feedbackItem/feedbackScreenshot';
import ScreenshotsModal, {
  modalCss,
} from 'sentry/components/feedback/feedbackItem/screenshotsModal';
import useFeedbackScreenshot from 'sentry/components/feedback/feedbackItem/useFeedbackHasScreenshot';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
};

export function ScreenshotSection({event, organization, projectSlug}: Props) {
  const {screenshots} = useFeedbackScreenshot({projectSlug, event});
  const {mutate: deleteAttachment} = useDeleteEventAttachmentOptimistic();

  return screenshots.length ? (
    <ScreenshotWrapper>
      {screenshots.map(screenshot => (
        <li key={screenshot.id}>
          <FixedSizeFeedbackScreenshot
            organization={organization}
            projectSlug={projectSlug}
            screenshot={screenshot}
            onClick={() => {
              openModal(
                modalProps => (
                  <ScreenshotsModal
                    {...modalProps}
                    organization={organization}
                    projectSlug={projectSlug}
                    screenshots={screenshots}
                    initialIndex={screenshots.indexOf(screenshot)}
                  />
                ),
                {modalCss}
              );
            }}
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
                onConfirm: () =>
                  deleteAttachment({
                    orgSlug: organization.slug,
                    projectSlug,
                    eventId: screenshot.event_id,
                    attachmentId: screenshot.id,
                  }),
                priority: 'danger',
              });
            }}
            aria-label={t('Delete screenshot')}
          />
        </li>
      ))}
    </ScreenshotWrapper>
  ) : null;
}

const ScreenshotWrapper = styled('ul')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1.5)};
  margin: 0;
  padding: 0;
  list-style: none;

  & > li {
    display: flex;
    gap: ${space(1)};
  }
`;

const FixedSizeFeedbackScreenshot = styled(FeedbackScreenshot)`
  max-width: 360px;
  max-height: 360px;
`;
