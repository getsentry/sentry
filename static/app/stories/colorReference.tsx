import styled from '@emotion/styled';

import {Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface ColorGroup {
  tokens: Record<string, string>;
  label?: string;
}

interface ColorReferenceProps {
  groups: ColorGroup[];
  renderToken: (props: {token: string; value: string}) => React.ReactNode;
  scale: string;
  /**
   * When true, tokens will expand to fill the available row width evenly.
   * Useful for background color swatches.
   */
  fill?: boolean;
  /**
   * When true, tokens will be rendered in a list layout
   */
  list?: boolean;
}

export function ColorReference({
  scale,
  groups,
  renderToken,
  list = false,
  fill,
  ...props
}: ColorReferenceProps) {
  return (
    <Flex
      gap="lg"
      padding="xl"
      radius="md"
      background="primary"
      border="primary"
      wrap="wrap"
      overflowY="hidden"
      overflowX="auto"
      {...props}
    >
      {groups.map((group, i) => (
        <Stack key={i} gap="sm" flexGrow={1}>
          {group.label && (
            <Text size="sm" variant="muted">
              {group.label}
            </Text>
          )}
          <Flex
            direction={list ? 'column' : 'row'}
            gap="0"
            align="stretch"
            justify="center"
          >
            {Object.entries(group.tokens).map(([token, value]) => (
              <ColorToken
                list={list}
                key={token}
                scale={scale}
                token={token}
                value={value}
                fill={fill}
              >
                {renderToken({token, value})}
              </ColorToken>
            ))}
          </Flex>
        </Stack>
      ))}
    </Flex>
  );
}

function ColorToken({
  list,
  children,
  token,
  value,
  scale,
  fill,
}: {
  children: React.ReactNode;
  list: boolean;
  scale: string;
  token: string;
  value: string;
  fill?: boolean;
}) {
  const {copy} = useCopyToClipboard();
  const handleCopy = () => copy(formatSnippet({token, scale}));
  return (
    <Tooltip
      maxWidth={480}
      skipWrapper
      title={
        <Flex gap="md" align="baseline" minWidth="max-content">
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
      <Button onClick={handleCopy} style={fill ? {width: '100%'} : undefined}>
        <Flex direction={list ? 'row' : 'column'} gap="sm" align="center">
          <Flex
            minWidth={fill ? undefined : '48px'}
            width={fill ? '100%' : undefined}
            height={list ? undefined : '48px'}
            align="center"
            justify="center"
          >
            {children}
          </Flex>
          <span>{token}</span>
        </Flex>
      </Button>
    </Tooltip>
  );
}

function formatSnippet({token, scale}: {scale: string; token: string}) {
  const parts = token.split('.');
  const accessor = parts
    .map(part => (/^[0-9]/.test(part) ? `["${part}"]` : `.${part}`))
    .join('');
  return `\${p => p.theme.tokens.${scale}${accessor}}`;
}

const Button = styled('button')`
  background: ${p => p.theme.tokens.interactive.transparent.neutral.background.rest};
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
  font-size: ${p => p.theme.font.size.sm};
  font-family: ${p => p.theme.font.family.mono};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  min-width: min-content;
  width: 100%;
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
