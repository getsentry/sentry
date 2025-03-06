import {useState} from 'react';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/button';
import Screenshot from 'sentry/components/events/eventTagsAndScreenshot/screenshot';
import ScreenshotModal, {
  modalCss,
} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import Link from 'sentry/components/links/link';
import {t, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {EventAttachmentFilter} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsFilter';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const SCREENSHOT_NAMES = [
  'screenshot.jpg',
  'screenshot.png',
  'screenshot-1.jpg',
  'screenshot-1.png',
  'screenshot-2.jpg',
  'screenshot-2.png',
];

interface ScreenshotDataSectionProps {
  event: Event;
  projectSlug: Project['slug'];
  isShare?: boolean;
}

export function ScreenshotDataSection({
  event,
  projectSlug,
  isShare,
  ...props
}: ScreenshotDataSectionProps) {
  const location = useLocation();
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
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

  const showScreenshot = !isShare && !!screenshots.length;
  const screenshot = screenshots[screenshotInFocus]!;

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
    trackAnalytics('issue_details.issue_tab.screenshot_modal_opened', {
      organization,
    });
    function handleDelete() {
      trackAnalytics('issue_details.issue_tab.screenshot_modal_deleted', {
        organization,
      });
      handleDeleteScreenshot(eventAttachment.id);
    }

    openModal(
      modalProps => (
        <ScreenshotModal
          {...modalProps}
          projectSlug={projectSlug}
          eventAttachment={eventAttachment}
          downloadUrl={downloadUrl}
          onDelete={handleDelete}
          onDownload={() =>
            trackAnalytics('issue_details.issue_tab.screenshot_modal_download', {
              organization,
            })
          }
          attachments={screenshots}
        />
      ),
      {modalCss}
    );
  }

  const linkPath = {
    pathname: `${location.pathname}${TabPaths[Tab.ATTACHMENTS]}`,
    query: {...location.query, attachmentFilter: EventAttachmentFilter.SCREENSHOT},
  };
  const title = tn('Screenshot', 'Screenshots', screenshots.length);

  return !showScreenshot ? null : (
    <InterimSection
      title={hasStreamlinedUI ? title : <Link to={linkPath}>{title}</Link>}
      showPermalink={false}
      help={t('This image was captured around the time that the event occurred.')}
      data-test-id="screenshot-data-section"
      type={SectionKey.SCREENSHOT}
      actions={
        hasStreamlinedUI ? (
          <LinkButton to={linkPath} size="xs">
            {t('View All')}
          </LinkButton>
        ) : null
      }
      {...props}
    >
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
    </InterimSection>
  );
}
