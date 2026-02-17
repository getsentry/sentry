import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

interface LayoutProps {
  children: React.ReactNode;
  label: string;
  hintText?: string;
  required?: boolean;
  /**
   * Use `variant="group"` for radio groups or checkbox groups.
   * Renders as `<fieldset>` + `<legend>` instead of `<div>` + `<label>`.
   */
  variant?: 'default' | 'group';
}

function RowLayout({variant = 'default', ...props}: LayoutProps) {
  if (variant === 'group') {
    return (
      <div>
        <FieldMeta.Fieldset>
          <Flex gap="sm" align="center" justify="between">
            <Stack width="50%" gap="xs">
              <FieldMeta.Legend required={props.required}>{props.label}</FieldMeta.Legend>
              {props.hintText ? (
                <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
              ) : null}
            </Stack>

            <Container flexGrow={1}>{props.children}</Container>
          </Flex>
        </FieldMeta.Fieldset>
      </div>
    );
  }

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

function StackLayout({variant = 'default', ...props}: LayoutProps) {
  if (variant === 'group') {
    return (
      <div>
        <FieldMeta.Fieldset>
          <Stack gap="md">
            <FieldMeta.Legend required={props.required}>{props.label}</FieldMeta.Legend>
            {props.children}
            {props.hintText ? (
              <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
            ) : null}
          </Stack>
        </FieldMeta.Fieldset>
      </div>
    );
  }

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
