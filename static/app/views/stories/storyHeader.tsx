import {ComponentProps} from 'react';
import styled from '@emotion/styled';

interface Props extends ComponentProps<'div'> {}

export default function StoryHeader({style}: Props) {
  return (
    <div style={style}>
      <H1>Sentry UI System</H1>
    </div>
  );
}

const H1 = styled('h1')`
  margin: 0;
`;
