import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {
  Container,
  Flex,
  Stack,
  type FlexProps,
  type StackProps,
} from '@sentry/scraps/layout';

interface LayoutProps {
  children: React.ReactNode;
  label: React.ReactNode;
  hintText?: React.ReactNode;
  required?: boolean;
  variant?: 'compact';
}

interface RowLayoutProps extends LayoutProps {
  padding?: FlexProps<'div'>['padding'];
}

function RowLayout(props: RowLayoutProps) {
  const isCompact = props.variant === 'compact';
  const field = useFieldContext();

  return (
    <HighlightableFlex
      id={field.name}
      direction="row"
      gap="sm"
      align="center"
      justify="between"
      padding={props.padding}
    >
      <Stack width="50%" gap="xs">
        <Flex gap="xs" align="center">
          <FieldMeta.Label
            required={props.required}
            description={isCompact ? props.hintText : undefined}
          >
            {props.label}
          </FieldMeta.Label>
        </Flex>
        {props.hintText && !isCompact ? (
          <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
        ) : null}
      </Stack>

      <Container flexGrow={1}>{props.children}</Container>
    </HighlightableFlex>
  );
}

interface StackLayoutProps extends LayoutProps {
  padding?: StackProps<'div'>['padding'];
}

function StackLayout(props: StackLayoutProps) {
  const isCompact = props.variant === 'compact';
  const field = useFieldContext();

  return (
    <HighlightableFlex
      id={field.name}
      direction="column"
      gap="md"
      padding={props.padding}
    >
      <Flex gap="xs" align="center">
        <FieldMeta.Label
          required={props.required}
          description={isCompact ? props.hintText : undefined}
        >
          {props.label}
        </FieldMeta.Label>
      </Flex>
      {props.children}
      {props.hintText && !isCompact ? (
        <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
      ) : null}
    </HighlightableFlex>
  );
}

export function FieldLayout() {
  return null;
}

FieldLayout.Row = RowLayout;
FieldLayout.Stack = StackLayout;

const highlightFade = keyframes`
  0% {
    background-color: var(--highlight-color);
  }
  100% {
    background-color: transparent;
  }
`;

const HighlightableFlex = styled(Flex)`
  --highlight-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  margin: calc(${p => p.theme.space.xl} * -1);
  padding: ${p => p.theme.space.xl};

  &[data-highlight] {
    animation: ${highlightFade} ${p => p.theme.motion.smooth.slow};
  }
`;
