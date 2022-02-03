import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import space from 'sentry/styles/space';

import Screenshot from './screenshot';
import Tags from './tags';

type ScreenshotProps = React.ComponentProps<typeof Screenshot>;

type Props = Omit<React.ComponentProps<typeof Tags>, 'projectSlug' | 'hasContext'> & {
  projectId: string;
  onDeleteScreenshot: ScreenshotProps['onDelete'];
  attachments: ScreenshotProps['screenshot'][];
  isShare?: boolean;
  isBorderless?: boolean;
  hasContext?: boolean;
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

  return (
    <Wrapper isBorderless={isBorderless}>
      {!isShare && !!screenshot && (
        <Screenshot
          organization={organization}
          event={event}
          projectSlug={projectSlug}
          screenshot={screenshot}
          onDelete={onDeleteScreenshot}
        />
      )}
      {(!!tags.length || hasContext) && (
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

const Wrapper = styled(DataSection)<{isBorderless: boolean}>`
  display: grid;
  gap: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    && {
      padding: 0;
      border: 0;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: ${space(2)};
    grid-template-columns: 1fr auto;
    gap: ${space(4)};

    > *:first-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
  }

  ${p =>
    p.isBorderless &&
    `
    && {
        padding: ${space(3)} 0 0 0;
        :first-child {
          padding-top: 0;
          border-top: 0;
        }
      }
    `}
`;
