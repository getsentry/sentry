import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import space from 'sentry/styles/space';
import {objectIsEmpty} from 'sentry/utils';

import Screenshot from './screenshot';
import Tags from './tags';
import TagsHighlight from './tagsHighlight';

type ScreenshotProps = React.ComponentProps<typeof Screenshot>;

type Props = Omit<
  React.ComponentProps<typeof Tags>,
  'projectSlug' | 'hasEventContext'
> & {
  attachments: ScreenshotProps['screenshot'][];
  onDeleteScreenshot: ScreenshotProps['onDelete'];
  projectId: string;
  hasContext?: boolean;
  isShare?: boolean;
};

function EventTagsAndScreenshots({
  projectId: projectSlug,
  location,
  event,
  attachments,
  onDeleteScreenshot,
  organization,
  isShare = false,
  hasContext = false,
}: Props) {
  const {tags = []} = event;

  const screenshot = attachments.find(
    ({name}) => name === 'screenshot.jpg' || name === 'screenshot.png'
  );

  if (!tags.length && !hasContext && (isShare || !screenshot)) {
    return null;
  }

  const showScreenshot = !isShare && !!screenshot;
  // Check for context bailout condition. No context is rendered if only user is provided
  const hasEventContext = hasContext && !objectIsEmpty(event.contexts);
  const showTags = !!tags.length || hasContext;

  return (
    <Wrapper showScreenshot={showScreenshot} showTags={showTags}>
      {showScreenshot && (
        <ScreenshotWrapper>
          <Screenshot
            organization={organization}
            event={event}
            projectSlug={projectSlug}
            screenshot={screenshot}
            onDelete={onDeleteScreenshot}
          />
        </ScreenshotWrapper>
      )}
      {showScreenshot && (showTags || hasEventContext) && <VerticalDivider />}
      <TagWrapper hasEventContext={hasEventContext}>
        {hasEventContext && (
          <TagsHighlightWrapper>
            <TagsHighlight event={event} />
          </TagsHighlightWrapper>
        )}
        {hasEventContext && showTags && <HorizontalDivider />}
        {showTags && (
          <Tags
            organization={organization}
            event={event}
            projectSlug={projectSlug}
            location={location}
          />
        )}
      </TagWrapper>
    </Wrapper>
  );
}

export default EventTagsAndScreenshots;

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
      p.showScreenshot && p.showTags ? 'max-content auto 1fr' : '1fr'};
  }
`;

const VerticalDivider = styled('div')`
  background: ${p => p.theme.innerBorder};
  height: 1px;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    height: 100%;
    width: 1px;
  }
`;

const ScreenshotWrapper = styled('div')`
  & > div {
    border: 0;
    height: 100%;
  }
`;

const TagWrapper = styled('div')<{hasEventContext: boolean}>`
  padding: ${p => (p.hasEventContext ? `${space(2)} 0` : '0')};
  overflow: hidden;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding: ${p => (p.hasEventContext ? `${space(2)} 0` : '0')};
  }
`;

const TagsHighlightWrapper = styled('div')`
  overflow: hidden;
  padding: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding: 0 ${space(4)};
  }
`;

const HorizontalDivider = styled('div')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.innerBorder};
`;
