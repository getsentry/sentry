import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import useStoriesLoader from 'sentry/views/stories/useStoriesLoader';

interface Props extends ComponentProps<'div'> {
  filename: string;
}

export default function StoryFile({filename, style}: Props) {
  const module = useStoriesLoader({filename});

  const {default: DefaultExport, ...otherExports} = module;
  const otherEntries = Object.entries(otherExports);

  return (
    <FlexColumn style={style}>
      <h2>{filename}</h2>
      {DefaultExport ? <DefaultExport /> : null}
      {otherEntries.map(([field, Component]) => (
        <Component key={field} />
      ))}
    </FlexColumn>
  );
}

const FlexColumn = styled('div')`
  display: flex;
  flex-direction: column;
  gap: var(--stories-grid-space);
`;
