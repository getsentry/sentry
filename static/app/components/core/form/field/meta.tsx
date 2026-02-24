import {VisuallyHidden} from '@react-aria/visually-hidden';

import {useFieldId, useHintTextId} from '@sentry/scraps/form/field/baseField';
import {useGroupContext} from '@sentry/scraps/form/field/groupContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
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

declare global {
  interface FocusOptions {
    /** https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#focusvisible */
    focusVisible?: boolean;
  }
}

const scrollToFieldRef = (node: HTMLLabelElement | null) => {
  if (!node) {
    return;
  }
  let hash: string;
  try {
    hash = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  if (hash === node.dataset.field) {
    requestAnimationFrame(() => {
      node.scrollIntoView({block: 'center', behavior: 'smooth'});
      node.control?.focus({focusVisible: true});
    });
  }
};

function Label(props: {
  children: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
}) {
  const {name: fieldName} = useFieldContext();
  const fieldId = useFieldId();
  const hintTextId = useHintTextId();
  const isGroup = useGroupContext();

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
            as={isGroup ? 'legend' : 'label'}
            data-field={fieldName}
            htmlFor={isGroup ? undefined : fieldId}
            bold={false}
            ref={scrollToFieldRef}
            style={isGroup ? legendStyles : undefined}
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

const legendStyles: React.CSSProperties = {
  /* Reset global legend styles */
  fontSize: 'inherit',
  border: 'none',
};

export function FieldMeta() {
  return null;
}

FieldMeta.Label = Label;
FieldMeta.HintText = HintText;
