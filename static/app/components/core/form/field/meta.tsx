import {VisuallyHidden} from '@react-aria/visually-hidden';

import {useFieldId, useHintTextId} from '@sentry/scraps/form/field/baseField';
import {RequiredIndicator} from '@sentry/scraps/form/icons';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

function HintText(props: {children: React.ReactNode}) {
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

function Label(props: {
  children: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
}) {
  const fieldId = useFieldId();
  const hintTextId = useHintTextId();

  const labelContent = props.description ? (
    <InfoText title={props.description}>{props.children}</InfoText>
  ) : (
    props.children
  );

  return (
    <Container width="fit-content">
      {containerProps => (
        <Flex gap="xs">
          <Text {...containerProps} as="label" htmlFor={fieldId} bold={false}>
            {labelContent}
          </Text>
          {props.required ? <RequiredIndicator /> : null}
          {/* Visually hidden text maintains aria-describedby linkage */}
          {props.description ? (
            <VisuallyHidden id={hintTextId}>{props.description}</VisuallyHidden>
          ) : null}
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
