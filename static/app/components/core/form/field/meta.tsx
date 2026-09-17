import {VisuallyHidden} from '@react-aria/visually-hidden';

import {useGroupContext} from '@sentry/scraps/form/field/groupContext';
import {fieldComponent, type AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {RequiredIndicator, Warning} from '@sentry/scraps/form/icons';
import {DisabledTip, InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getFieldId, getHintTextId, getLabelId} from './baseField';

function HintText(props: {children: React.ReactNode; field: AnyFieldApi}) {
  const id = getHintTextId(props.field);

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
  field: AnyFieldApi;
  description?: React.ReactNode;
  required?: boolean;
}) {
  const fieldId = getFieldId(props.field);
  const hintTextId = getHintTextId(props.field);
  const labelId = getLabelId(props.field);
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

function FieldStatus({
  disabled,
  error,
  field,
}: {
  field: AnyFieldApi;
  disabled?: boolean | string;
  error?: string;
}) {
  const errorMessage =
    error ??
    (field.meta.isValid ? undefined : field.errors.map(e => e.message).join(','));

  if (errorMessage) {
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

FieldMeta.Label = fieldComponent.loose(Label, 'field');
FieldMeta.HintText = fieldComponent.loose(HintText, 'field');
FieldMeta.Status = fieldComponent.loose(FieldStatus, 'field');
