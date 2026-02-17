import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

interface LayoutProps {
  children: React.ReactNode;
  label: string;
  hintText?: string;
  required?: boolean;
  variant?: 'compact';
}

function RowLayout(props: LayoutProps) {
  const isCompact = props.variant === 'compact';

  return (
    <Flex gap="sm" align="center" justify="between">
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
    </Flex>
  );
}

function StackLayout(props: LayoutProps) {
  const isCompact = props.variant === 'compact';

  return (
    <Stack gap="md">
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
    </Stack>
  );
}

export function FieldLayout() {
  return null;
}

FieldLayout.Row = RowLayout;
FieldLayout.Stack = StackLayout;
