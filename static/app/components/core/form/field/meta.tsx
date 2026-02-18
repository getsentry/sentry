import {VisuallyHidden} from '@react-aria/visually-hidden';

import {useFieldId, useHintTextId} from '@sentry/scraps/form/field/baseField';
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
  if (hash !== node.dataset.field) {
    return;
  }

  let attempts = 0;
  const maxAttempts = 10;

  const tryScrollAndFocus = () => {
    attempts++;
    const control = node.control;

    if (control) {
      node.scrollIntoView({block: 'center', behavior: 'smooth'});
      control.focus({focusVisible: true});

      const fieldRow = node.closest<HTMLElement>(`[id="${CSS.escape(hash)}"]`);
      if (fieldRow) {
        fieldRow.dataset.highlight = '';
        fieldRow.addEventListener(
          'animationend',
          () => delete fieldRow.dataset.highlight,
          {once: true}
        );
      }
      return;
    }

    if (attempts < maxAttempts) {
      requestAnimationFrame(tryScrollAndFocus);
    }
  };

  requestAnimationFrame(tryScrollAndFocus);
};

function Label(props: {
  children: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
}) {
  const {name: fieldName} = useFieldContext();
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
            data-field={fieldName}
            htmlFor={fieldId}
            bold={false}
            ref={scrollToFieldRef}
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
