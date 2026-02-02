import {useFieldId, useHintTextId} from '@sentry/scraps/form/field/baseField';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

function HintText(props: {children: string}) {
  const id = useHintTextId();

  return (
    <Container width="fit-content">
      {containerProps => (
        <Text {...containerProps} size="sm" variant="muted" id={id}>
          {props.children}
        </Text>
      )}
    </Container>
  );
}

function Label(props: {children: string; required?: boolean}) {
  const fieldId = useFieldId();

  return (
    <Container width="fit-content">
      {containerProps => (
        <Flex gap="xs">
          <Text {...containerProps} as="label" htmlFor={fieldId}>
            {props.children}
          </Text>
          {props.required ? <Text variant="danger">*</Text> : null}
        </Flex>
      )}
    </Container>
  );
}

export function FieldMeta() {
  return null;
}

FieldMeta.Label = Label;
FieldMeta.HintText = HintText;
