import {useFieldId} from '@sentry/scraps/form/field/baseField';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

function HintText(props: {children: string}) {
  return (
    <Container width="fit-content">
      {containerProps => (
        <Text {...containerProps} size="sm" variant="muted">
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
        <Text {...containerProps} as="label" htmlFor={fieldId}>
          {props.children} {props.required ? <Text variant="danger">*</Text> : null}
        </Text>
      )}
    </Container>
  );
}

export function Meta() {
  return null;
}

Meta.Label = Label;
Meta.HintText = HintText;
