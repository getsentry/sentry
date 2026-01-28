import {Meta} from '@sentry/scraps/form/field/meta';
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
        <Meta.Label required={props.required}>{props.label}</Meta.Label>
        {props.hintText ? <Meta.HintText>{props.hintText}</Meta.HintText> : null}
      </Stack>

      <Container flexGrow={1}>{props.children}</Container>
    </Flex>
  );
}

function StackLayout(props: LayoutProps) {
  return (
    <Stack gap="md">
      <Meta.Label required={props.required}>{props.label}</Meta.Label>
      {props.children}
      {props.hintText ? <Meta.HintText>{props.hintText}</Meta.HintText> : null}
    </Stack>
  );
}

export function Layout() {
  return null;
}

Layout.Row = RowLayout;
Layout.Stack = StackLayout;
