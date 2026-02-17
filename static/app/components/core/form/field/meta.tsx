import styled from '@emotion/styled';

import {useFieldId, useHintTextId} from '@sentry/scraps/form/field/baseField';
import {RequiredIndicator} from '@sentry/scraps/form/icons';
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
          {props.required ? <RequiredIndicator /> : null}
        </Flex>
      )}
    </Container>
  );
}

function Legend(props: {children: string; required?: boolean}) {
  return (
    <Flex gap="xs">
      <StyledLegend>{props.children}</StyledLegend>
      {props.required ? <RequiredIndicator /> : null}
    </Flex>
  );
}

const Fieldset = styled('fieldset')`
  border: none;
  padding: 0;
  margin: 0;
`;

const StyledLegend = styled('legend')`
  /* Reset global legend styles */
  display: inline;
  width: auto;
  padding: 0;
  margin: 0;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  border: none;
`;

export function FieldMeta() {
  return null;
}

FieldMeta.Label = Label;
FieldMeta.HintText = HintText;
FieldMeta.Legend = Legend;
FieldMeta.Fieldset = Fieldset;
