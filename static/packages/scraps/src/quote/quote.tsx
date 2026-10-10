import {Fragment, type ReactNode} from 'react';
import {css, cx} from '@linaria/core';

import {Stack} from '@sentry/scraps/layout';
import type {StackProps} from '@sentry/scraps/layout';

import {Text} from '../text';

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

const styles = {
  line: css`
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    margin: 0;
    border-style: none;
    height: 100%;
    width: 1px;
    padding-left: 16px;
    margin-left: 12px;
    border-left-width: 1px;
    border-left-style: solid;
    border-left-color: var(--ln-border-primary, #dad9de);
  `,
  content: css`
    margin: 0;
    padding: 0;
    border-style: none;
    padding-left: calc(16px + 12px);
  `,
};

export function Quote(props: QuoteProps) {
  const {children, ...spreadProps} = props;
  return (
    <Stack gap="md" as="figure" position="relative" {...spreadProps}>
      <hr aria-orientation="vertical" {...{className: cx(styles.line)}} />
      <blockquote cite={props.source?.href} {...{className: cx(styles.content)}}>
        {children}
      </blockquote>
      {props.source ? (
        <figcaption {...{className: cx(styles.content)}}>
          <Text as="p">
            &ndash;&nbsp;
            {props.source.author}
            {props.source?.label ? (
              <Fragment>
                , <cite>{props.source.label}</cite>
              </Fragment>
            ) : null}
          </Text>
        </figcaption>
      ) : null}
    </Stack>
  );
}
