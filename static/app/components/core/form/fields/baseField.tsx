import {Fragment, useId} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Checkmark, Spinner, Warning} from '@sentry/scraps/form/icons';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

export type BaseFieldProps = {
  label: string;
  hintText?: string;
  required?: boolean;
};

type FieldChildrenProps = {
  'aria-invalid': boolean;
  id: string;
  name: string;
  onBlur: () => void;
};

type FieldStateProps = {
  indicator: React.JSX.Element | null;
};

const useFieldStateIndicator = () => {
  const field = useFieldContext();
  const hasValidationError = field.state.meta.isTouched && !field.state.meta.isValid;
  const status = useAutoSaveContext()?.status;

  if (status === 'pending') {
    return <Spinner />;
  }

  if (status === 'success') {
    return <Checkmark variant="success" size="sm" />;
  }

  if (hasValidationError) {
    const errorMessage = field.state.meta.errors.map(e => e?.message).join(',');
    return (
      <Tooltip position="bottom" offset={8} title={errorMessage} forceVisible skipWrapper>
        <Warning variant="danger" size="sm" />
      </Tooltip>
    );
  }
  return null;
};

export function BaseField(
  props: BaseFieldProps & {
    children: (props: FieldChildrenProps, state: FieldStateProps) => React.ReactNode;
  }
) {
  const field = useFieldContext();
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;
  const indicator = useFieldStateIndicator();
  const fieldId = useId();

  return (
    <Flex gap="sm" align="center" justify="between" padding="xl">
      <Stack width="50%" gap="xs">
        <Container width="fit-content">
          {containerProps => (
            <Fragment>
              <Text {...containerProps} as="label" htmlFor={fieldId}>
                {props.label} {props.required ? <Text variant="danger">*</Text> : null}
              </Text>
              {props.hintText ? (
                <Text {...containerProps} size="sm" variant="muted">
                  {props.hintText}
                </Text>
              ) : null}
            </Fragment>
          )}
        </Container>
      </Stack>

      <Container flexGrow={1}>
        {props.children(
          {
            'aria-invalid': hasError,
            onBlur: field.handleBlur,
            name: field.name,
            id: fieldId,
          },
          {indicator}
        )}
      </Container>
    </Flex>
  );
}
