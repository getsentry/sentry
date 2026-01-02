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
   * When specified, tokens will be displayed in a grid with the given number of columns.
   */
  columns?: number;
  /**
   * When true, tokens will expand to fill the available row width evenly.
   * Useful for background color swatches.
   */
  fill?: boolean;
}

export function ColorReference({
  scale,
  groups,
  renderToken,
  columns,
  fill,
}: ColorReferenceProps) {
  const containerStyle = columns
    ? {display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '16px'}
    : undefined;

  return (
    <Flex
      gap="lg"
      padding="xl"
      radius="md"
      background="primary"
      border="primary"
      wrap="wrap"
      style={containerStyle}
    >
      {groups.map((group, i) => (
        <Stack key={i} gap="sm" flexGrow={columns ? undefined : 1}>
          {group.label && (
            <Text size="sm" variant="muted">
              {group.label}
            </Text>
          )}
          <Flex gap="0">
            {Object.entries(group.tokens).map(([token, value]) => (
              <ColorToken
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
  children,
  token,
  value,
  scale,
  fill,
}: {
  children: React.ReactNode;
  scale: string;
  token: string;
  value: string;
  fill?: boolean;
}) {
  const {copy} = useCopyToClipboard();
  const handleCopy = () => copy(formatSnippet({token, scale}));
  return (
    <Tooltip
      style={fill ? {flex: 1, minWidth: 0} : undefined}
      maxWidth={480}
      title={
        <Flex gap="md" align="baseline">
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
        <Stack gap="xs" align="center" justify="center">
          <Flex
            minWidth={fill ? undefined : '48px'}
            width={fill ? '100%' : undefined}
            height="48px"
            align="center"
            justify="center"
          >
            {children}
          </Flex>
          <span>{token}</span>
        </Stack>
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
