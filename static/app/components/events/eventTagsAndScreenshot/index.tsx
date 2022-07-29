import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import space from 'sentry/styles/space';
import {objectIsEmpty} from 'sentry/utils';

import Screenshot from './screenshot';
import Tags from './tags';

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
    <Wrapper
      showScreenshot={showScreenshot}
      showTags={showTags}
      hasContext={hasEventContext}
    >
      {showScreenshot && (
        <Screenshot
          organization={organization}
          event={event}
          projectSlug={projectSlug}
          screenshot={screenshot}
          onDelete={onDeleteScreenshot}
        />
      )}
      {showScreenshot && showTags && <Divider />}
      {showTags && (
        <Tags
          organization={organization}
          event={event}
          projectSlug={projectSlug}
          hasEventContext={hasEventContext}
          location={location}
        />
      )}
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
  hasContext: boolean;
  showScreenshot: boolean;
  showTags: boolean;
}>`
  ${p => !p.hasContext && !p.showScreenshot && `padding: 0;`}

  > * {
    :first-child,
    :last-child {
      border: 0;
    }

    ${p =>
      p.showScreenshot
        ? css`
            :first-child {
              padding: 0 ${space(3)} ${space(3)} ${space(3)};
            }
          `
        : css`
            :first-child {
              padding: 0;
            }
          `}
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-template-columns: ${p =>
      p.showScreenshot && p.showTags ? 'max-content auto 1fr' : '1fr'};
    padding-top: 0;
    padding-bottom: 0;
    && {
      > * {
        ${p =>
          p.hasContext &&
          css`
            :last-child {
              padding: ${space(3)} 0;
            }
          `}

        ${p =>
          p.showScreenshot &&
          css`
            :first-child {
              padding: ${space(3)} ${space(4)};
            }
          `}

        :last-child {
          overflow: hidden;
        }
      }
    }
  }

  && {
    padding-left: 0;
    padding-right: 0;
  }
`;

const Divider = styled('div')`
  background: ${p => p.theme.innerBorder};
  height: 1px;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    height: 100%;
    width: 1px;
  }
`;
