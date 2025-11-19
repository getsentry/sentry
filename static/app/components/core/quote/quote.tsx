import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import type {StackProps} from '@sentry/scraps/layout/stack';
import {Text} from '@sentry/scraps/text';

// interface + type union because `extends` doesn't play nicely with generics
interface QuoteBaseProps {
  children: ReactNode;
  source?: {
    author?: string;
    href?: string;
    label?: string;
  };
}
export type QuoteProps = QuoteBaseProps & Omit<StackProps<'blockquote'>, 'children'>;

export function Quote(props: QuoteProps) {
  const {children, ...spreadProps} = props;
  return (
    <Stack gap="md" as="figure" position="relative" {...spreadProps}>
      <Line aria-orientation="vertical" />
      <Blockquote cite={props.source?.href} as="blockquote">
        {children}
      </Blockquote>
      {props.source ? (
        <Caption>
          <Text as="p">
            &ndash;&nbsp;
            {props.source.author}
            {props.source?.label ? (
              <Fragment>
                , <cite>{props.source.label}</cite>
              </Fragment>
            ) : null}
          </Text>
        </Caption>
      ) : null}
    </Stack>
  );
}

const Line = styled('hr')`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  margin: 0;
  border: none;
  height: 100%;
  width: 1px;
  padding-left: ${p => p.theme.space.xl};
  margin-left: ${p => p.theme.space.lg};
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const Blockquote = styled('blockquote')`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;
  padding-left: calc(${p => `${p.theme.space.xl} + ${p.theme.space.lg}`});
`;

const Caption = styled('figcaption')`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;
  padding-left: calc(${p => `${p.theme.space.xl} + ${p.theme.space.lg}`});
`;
