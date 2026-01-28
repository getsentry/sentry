import {Meta} from '@sentry/scraps/form/field/meta';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

interface RowProps {
  children: React.ReactNode;
  label: string;
  hintText?: string;
  required?: boolean;
}

function Row(props: RowProps) {
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

export function Layout() {
  return null;
}

Layout.Row = Row;
