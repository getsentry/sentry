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
      border="muted"
      radius="md"
      gap="lg"
      overflowY="hidden"
      overflowX="auto"
      background="tertiary"
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
          <Text size="sm" monospace variant="accent">
            {token}
          </Text>
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
  background: transparent;
  border: none;
  border-radius: ${p => p.theme.radius.md};
  cursor: copy;

  &:hover,
  &:focus {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:active {
    background: ${p => p.theme.tokens.background.primary};
  }
`;
