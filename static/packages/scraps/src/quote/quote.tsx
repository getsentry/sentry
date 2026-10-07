import {Fragment, type ReactNode} from 'react';
import * as stylex from '@stylexjs/stylex';

import {Stack} from '@sentry/scraps/layout';
import type {StackProps} from '@sentry/scraps/layout';
import {space} from '@sentry/scraps/theme/constants.stylex';
import {border} from '@sentry/scraps/theme/tokens.stylex';

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

const styles = stylex.create({
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    margin: 0,
    borderStyle: 'none',
    height: '100%',
    width: '1px',
    paddingLeft: space.xl,
    marginLeft: space.lg,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: border.primary,
  },
  // Reset any properties that might be set by the global CSS styles.
  content: {
    margin: 0,
    padding: 0,
    borderStyle: 'none',
    paddingLeft: `calc(${space.xl} + ${space.lg})`,
  },
});

export function Quote(props: QuoteProps) {
  const {children, ...spreadProps} = props;
  return (
    <Stack gap="md" as="figure" position="relative" {...spreadProps}>
      <hr aria-orientation="vertical" {...stylex.props(styles.line)} />
      <blockquote cite={props.source?.href} {...stylex.props(styles.content)}>
        {children}
      </blockquote>
      {props.source ? (
        <figcaption {...stylex.props(styles.content)}>
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
