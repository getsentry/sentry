import {useState} from 'react';
import styled from '@emotion/styled';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import {t, tn} from 'sentry/locale';
import {EventAttachment} from 'sentry/types/group';
import {objectIsEmpty} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SCREENSHOT_TYPE} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsFilter';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

import Modal, {modalCss} from './screenshot/modal';
import Screenshot from './screenshot';
import Tags from './tags';

const SCREENSHOT_NAMES = [
  'screenshot.jpg',
  'screenshot.png',
  'screenshot-1.jpg',
  'screenshot-1.png',
  'screenshot-2.jpg',
  'screenshot-2.png',
];

type Props = Omit<
  React.ComponentProps<typeof Tags>,
  'projectSlug' | 'hasEventContext'
> & {
  projectSlug: string;
  isShare?: boolean;
};

export function EventTagsAndScreenshot({
  projectSlug,
  location,
  event,
  organization,
  isShare = false,
}: Props) {
  const {tags = []} = event;
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

  if (!tags.length && !hasContext && (isShare || !screenshots.length)) {
    return null;
  }

  const showScreenshot = !isShare && !!screenshots.length;
  const screenshot = screenshots[screenshotInFocus];
  // Check for context bailout condition. No context is rendered if only user is provided
  const hasEventContext = hasContext && !objectIsEmpty(event.contexts);
  const showTags = !!tags.length || hasContext;

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
        <Modal
          {...modalProps}
          event={event}
          orgSlug={organization.slug}
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
          attachmentIndex={screenshotInFocus}
        />
      ),
      {modalCss}
    );
  }

  const screenshotLink = (
    <Link
      to={{
        pathname: `${location.pathname}${TabPaths[Tab.ATTACHMENTS]}`,
        query: {...location.query, types: SCREENSHOT_TYPE},
      }}
    >
      {tn('Screenshot', 'Screenshots', screenshots.length)}
    </Link>
  );

  return (
    <Wrapper showScreenshot={showScreenshot} showTags={showTags}>
      <TagWrapper>
        {showTags && (
          <Tags
            organization={organization}
            event={event}
            projectSlug={projectSlug}
            location={location}
            hasEventContext={hasEventContext}
          />
        )}
      </TagWrapper>
      {showScreenshot && (
        <div>
          <ScreenshotWrapper>
            <StyledScreenshotDataSection
              title={screenshotLink}
              showPermalink={false}
              help={t('This image was captured around the time that the event occurred.')}
              type="screenshot-data-section"
              data-test-id="screenshot-data-section"
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
            </StyledScreenshotDataSection>
          </ScreenshotWrapper>
        </div>
      )}
    </Wrapper>
  );
}

/**
 * Used to adjust padding based on which 3 elements are shown
 * - screenshot
 * - context
 * - tags
 */
const Wrapper = styled(DataSection)<{
  showScreenshot: boolean;
  showTags: boolean;
}>`
  padding: 0;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding: 0;
    display: grid;
    grid-template-columns: ${p =>
      p.showScreenshot && p.showTags ? 'auto max-content' : '1fr'};
  }
`;

const StyledScreenshotDataSection = styled(EventDataSection)`
  h3 a {
    color: ${p => p.theme.linkColor};
  }
`;

const ScreenshotWrapper = styled('div')`
  & > div {
    border: 0;
    height: 100%;
  }
`;

const TagWrapper = styled('div')`
  overflow: hidden;
`;
