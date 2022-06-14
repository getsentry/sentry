import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import space from 'sentry/styles/space';

import Screenshot from './screenshot';
import Tags from './tags';

type ScreenshotProps = React.ComponentProps<typeof Screenshot>;

type Props = Omit<React.ComponentProps<typeof Tags>, 'projectSlug' | 'hasContext'> & {
  attachments: ScreenshotProps['screenshot'][];
  onDeleteScreenshot: ScreenshotProps['onDelete'];
  projectId: string;
  hasContext?: boolean;
  isBorderless?: boolean;
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
  isBorderless = false,
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
  const showTags = !!tags.length || hasContext;

  return (
    <Wrapper
      isBorderless={isBorderless}
      showScreenshot={showScreenshot}
      showTags={showTags}
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
          hasContext={hasContext}
          location={location}
        />
      )}
    </Wrapper>
  );
}

export default EventTagsAndScreenshots;

const Wrapper = styled(DataSection)<{
  isBorderless: boolean;
  showScreenshot: boolean;
  showTags: boolean;
}>`
  > * {
    :first-child,
    :last-child {
      border: 0;
      padding: 0;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-template-columns: ${p =>
      p.showScreenshot && p.showTags ? 'max-content auto 1fr' : '1fr'};
    padding-top: 0;
    padding-bottom: 0;
    && {
      > * {
        :first-child,
        :last-child {
          border: 0;
          padding: ${space(3)} 0;
        }
      }
    }
  }

  ${p =>
    p.isBorderless &&
    css`
      && {
        padding-left: 0;
        padding-right: 0;
      }
    `}
`;

const Divider = styled('div')`
  background: ${p => p.theme.innerBorder};
  height: 1px;
  width: 100%;
  margin: ${space(3)} 0;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    height: 100%;
    width: 1px;
    margin: 0 ${space(3)};
  }
`;
