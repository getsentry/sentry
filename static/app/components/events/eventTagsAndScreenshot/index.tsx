import styled from '@emotion/styled';

import {useFetchEventAttachments} from 'sentry/actionCreators/events';
import {ScreenshotDataSection} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotDataSection';
import {SCREENSHOT_NAMES} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/utils';
import {DataSection} from 'sentry/components/events/styles';
import useOrganization from 'sentry/utils/useOrganization';

import EventTagsDataSection from './tags';

type Props = React.ComponentProps<typeof EventTagsDataSection> & {
  isShare?: boolean;
};

export function EventTagsAndScreenshot({projectSlug, event, isShare = false}: Props) {
  const organization = useOrganization();
  const {tags = []} = event;
  const {data: attachments} = useFetchEventAttachments(
    {
      orgSlug: organization.slug,
      projectSlug,
      eventId: event.id,
    },
    {enabled: !isShare}
  );
  const screenshots =
    attachments?.filter(({name}) => SCREENSHOT_NAMES.includes(name)) ?? [];

  if (!tags.length && (isShare || !screenshots.length)) {
    return null;
  }

  const showScreenshot = !isShare && !!screenshots.length;
  const showTags = !!tags.length;

  return (
    <Wrapper showScreenshot={showScreenshot} showTags={showTags}>
      <div>
        {showTags && <EventTagsDataSection event={event} projectSlug={projectSlug} />}
      </div>
      {showScreenshot && (
        <div>
          <ScreenshotWrapper>
            <StyledScreenshotDataSection
              event={event}
              isShare={isShare}
              projectSlug={projectSlug}
            />
          </ScreenshotWrapper>
        </div>
      )}
    </Wrapper>
  );
}

/**
 * Used to adjust padding based on which elements are shown
 * - screenshot
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

const StyledScreenshotDataSection = styled(ScreenshotDataSection)`
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
