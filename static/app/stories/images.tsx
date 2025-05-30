import styled from '@emotion/styled';

export function Image(props: {src: string}): React.ReactNode {
  return <IntrinsicImage src={props.src} />;
}

const IntrinsicImage = styled('img')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 400px;
`;
