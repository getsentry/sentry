import {VisuallyHidden} from '@react-aria/visually-hidden';

import {useFieldId, useHintTextId, useLabelId} from '@sentry/scraps/form/field/baseField';
import {useGroupContext} from '@sentry/scraps/form/field/groupContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {RequiredIndicator, Warning} from '@sentry/scraps/form/icons';
import {DisabledTip, InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
  const labelId = useLabelId();
  const isGroup = useGroupContext();

  const labelContent = props.description ? (
    <InfoText title={props.description}>{props.children}</InfoText>
  ) : (
    props.children
  );

  const labelProps = isGroup
    ? {
        as: 'span' as const,
        cursor: 'default' as const,
        id: labelId,
      }
    : {
        as: 'label' as const,
        htmlFor: fieldId,
      };

  return (
    <Container width="fit-content">
      {containerProps => (
        <Flex gap="xs">
          <Text {...containerProps} {...labelProps} bold={false}>
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

function FieldStatus({disabled}: {disabled?: boolean | string}) {
  const field = useFieldContext();

  if (!field.state.meta.isValid) {
    const errorMessage = field.state.meta.errors.map(e => e?.message).join(',');
    return (
      <Tooltip position="bottom" title={errorMessage} forceVisible skipWrapper>
        <Warning variant="danger" size="sm" />
      </Tooltip>
    );
  }

  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  if (disabledReason) {
    return <DisabledTip title={disabledReason} size="sm" />;
  }

  return null;
}

export function FieldMeta() {
  return null;
}

FieldMeta.Label = Label;
FieldMeta.HintText = HintText;
FieldMeta.Status = FieldStatus;
