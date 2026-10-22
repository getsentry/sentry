import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';

import {BaseLayout, LayoutLabel} from './base';
import {useStackedLayout} from './useStackedLayout';

interface LayoutProps {
  children: React.ReactNode;
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
  const field = useFieldContext();

  return (
    <BaseLayout id={field.name} stacked={false} padding={props.padding}>
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
  const field = useFieldContext();

  return (
    <BaseLayout id={field.name} stacked align={props.align}>
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

FieldLayout.Row = RowLayout;
FieldLayout.Stack = StackLayout;
