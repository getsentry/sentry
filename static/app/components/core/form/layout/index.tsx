import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

interface LayoutProps {
  children: React.ReactNode;
  label: string;
  hintText?: string;
  required?: boolean;
}

function RowLayout(props: LayoutProps) {
  return (
    <Flex gap="sm" align="center" justify="between">
      <Stack width="50%" gap="xs">
        <FieldMeta.Label required={props.required}>{props.label}</FieldMeta.Label>
        {props.hintText ? (
          <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
        ) : null}
      </Stack>

      <Container flexGrow={1}>{props.children}</Container>
    </Flex>
  );
}

function StackLayout(props: LayoutProps) {
  return (
    <Stack gap="md">
      <FieldMeta.Label required={props.required}>{props.label}</FieldMeta.Label>
      {props.children}
      {props.hintText ? <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText> : null}
    </Stack>
  );
}

export function FieldLayout() {
  return null;
}

FieldLayout.Row = RowLayout;
FieldLayout.Stack = StackLayout;
