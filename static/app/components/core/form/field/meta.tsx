import {VisuallyHidden} from '@react-aria/visually-hidden';

import {useFieldId, useHintTextId} from '@sentry/scraps/form/field/baseField';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {RequiredIndicator} from '@sentry/scraps/form/icons';
import {InfoText} from '@sentry/scraps/info';
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

declare global {
  interface FocusOptions {
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#focusvisible
    focusVisible?: boolean;
  }
}

function Label(props: {children: string; description?: string; required?: boolean}) {
  const field = useFieldContext();
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
          <Text
            {...containerProps}
            as="label"
            htmlFor={fieldId}
            bold={false}
            ref={instance => {
              if (!instance) {
                return;
              }
              if (decodeURIComponent(window.location.hash.slice(1)) === field.name) {
                instance.scrollIntoView({block: 'center', behavior: 'smooth'});
                instance.control?.focus({focusVisible: true});
              }
            }}
          >
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
