import type * as React from 'react';

import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';

import {BaseLayout, LayoutLabel} from './base';
import {fieldComponent, type FieldWithValue} from './formHelpers';
import {FieldMeta} from './meta';
import {useStackedLayout} from './useStackedLayout';

interface LayoutProps {
  children: React.ReactNode;
  field: FieldWithValue<unknown>;
  label: React.ReactNode;
  hintText?: React.ReactNode;
  required?: boolean;
  variant?: 'compact';
}

interface RowLayoutProps extends LayoutProps {
  padding?: FlexProps['padding'];
}

interface StackLayoutProps extends LayoutProps {
  align?: FlexProps['align'];
}

function RowLayout(props: RowLayoutProps) {
  const isStackLayout = useStackedLayout();

  return isStackLayout ? <StackLayout {...props} /> : <RowLayoutContent {...props} />;
}

function RowLayoutContent(props: RowLayoutProps) {
  const isCompact = props.variant === 'compact';

  return (
    <BaseLayout id={props.field.name} stacked={false} padding={props.padding}>
      <LayoutLabel stacked={false}>
        <Flex gap="xs" align="center">
          <FieldMeta.Label
            required={props.required}
            description={isCompact ? props.hintText : undefined}
          >
            {props.label}
          </FieldMeta.Label>
        </Flex>
        {props.hintText && !isCompact ? (
          <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
        ) : null}
      </LayoutLabel>

      <Container flexGrow={1}>{props.children}</Container>
    </BaseLayout>
  );
}

function StackLayout(props: StackLayoutProps) {
  const isCompact = props.variant === 'compact';

  return (
    <BaseLayout id={props.field.name} stacked align={props.align}>
      <Flex gap="xs" align="center">
        <FieldMeta.Label
          required={props.required}
          description={isCompact ? props.hintText : undefined}
        >
          {props.label}
        </FieldMeta.Label>
      </Flex>
      {props.children}
      {props.hintText && !isCompact ? (
        <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
      ) : null}
    </BaseLayout>
  );
}

export function FieldLayout() {
  return null;
}

FieldLayout.Row = fieldComponent.loose(RowLayout, 'field');
FieldLayout.Stack = fieldComponent.loose(StackLayout, 'field');
