import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import TextOverflow from 'sentry/components/textOverflow';
import {IconGithub} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useStoriesLoader from 'sentry/views/stories/useStoriesLoader';

interface Props extends ComponentProps<'div'> {
  filename: string;
}

export default function StoryFile({filename, style}: Props) {
  const module = useStoriesLoader({filename});

  const {default: DefaultExport, ...otherExports} = module;
  const otherEntries = Object.entries(otherExports);

  const githubViewUrl = `https://github.com/getsentry/sentry/blob/master/static/${filename}`;
  const githubEditUrl = `https://github.com/getsentry/sentry/edit/master/static/${filename}`;

  return (
    <FlexColumn style={style}>
      <FlexRow style={{justifyContent: 'space-between'}}>
        <Header>
          <TextOverflow>{filename}</TextOverflow>
        </Header>
        <FlexRow style={{gap: space(1)}}>
          <LinkButton
            href={githubViewUrl}
            external
            icon={<IconGithub />}
            size="xs"
            aria-label="View on GitHub"
          >
            View
          </LinkButton>
          <LinkButton
            href={githubEditUrl}
            external
            icon={<IconGithub />}
            size="xs"
            aria-label="View on GitHub"
          >
            Edit
          </LinkButton>
        </FlexRow>
      </FlexRow>

      <StoryArea>{DefaultExport ? <DefaultExport /> : null}</StoryArea>
      {otherEntries.map(([field, Component]) => (
        <Component key={field} />
      ))}
    </FlexColumn>
  );
}

const FlexRow = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--stories-grid-space);
  align-content: flex-start;
`;
const FlexColumn = styled('div')`
  display: flex;
  flex-direction: column;
  gap: var(--stories-grid-space);
  max-height: 100%;
`;
const StoryArea = styled('div')`
  overflow: scroll;
`;

const Header = styled('h2')`
  margin: 0;
`;
