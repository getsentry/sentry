import styled from '@emotion/styled';

import {Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface TokenReferenceProps {
  renderToken: (props: {token: string; value: string | number}) => React.ReactNode;
  scale: string;
  tokens: Record<string, string | number>;
}

export function TokenReference(props: TokenReferenceProps) {
  return (
    <Flex
      align="center"
      justify="center"
      padding="2xl md"
      radius="md"
      gap="0"
      overflowY="hidden"
      overflowX="auto"
      background="primary"
      border="primary"
    >
      {Object.entries(props.tokens).map(([token, value]) => (
        <Token key={token} scale={props.scale} {...{token, value}}>
          {props.renderToken({value, token})}
        </Token>
      ))}
    </Flex>
  );
}

function Token({
  children,
  token,
  value,
  scale,
}: {
  children: React.ReactNode;
  scale: string;
  token: string;
  value: string | number;
}) {
  const {copy} = useCopyToClipboard();
  const handleCopy = () => copy(formatSnippet({token, scale}));
  return (
    <Tooltip
      maxWidth={640}
      title={
        <Flex gap="md" align="baseline" wrap="wrap-reverse">
          <Heading as="h4" size="md">
            {scale}
          </Heading>
          <Text>{token}</Text>
          <Text variant="muted" monospace wrap="nowrap">
            {value}
          </Text>
        </Flex>
      }
    >
      <Button onClick={handleCopy}>
        <Stack gap="sm" paddingBottom="md" align="center" justify="center">
          <Flex minWidth="64px" height="64px" align="center" justify="center">
            {children}
          </Flex>
          <span>{token}</span>
        </Stack>
      </Button>
    </Tooltip>
  );
}

function formatSnippet({token, scale}: {scale: string; token: string}) {
  const accessor = /^[0-9]/.test(token) ? `["${token}"]` : `.${token}`;
  return `\${p => p.theme.tokens.${scale}${accessor}}`;
}

const Button = styled('button')`
  background: ${p => p.theme.tokens.interactive.transparent.neutral.background.rest};
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  font-size: ${p => p.theme.font.size.sm};
  font-family: ${p => p.theme.font.family.mono};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border: none;
  cursor: copy;

  &:hover,
  &:focus {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
    color: ${p => p.theme.tokens.interactive.link.neutral.hover};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
    color: ${p => p.theme.tokens.interactive.link.neutral.active};
  }
`;
