import type {HTMLProps, PropsWithChildren} from 'react';
import React from 'react';
import {type Callout as CalloutProps} from '@r4ai/remark-callout';

import {Alert, type AlertProps} from '@sentry/scraps/alert';
import {Quote, type QuoteProps} from '@sentry/scraps/quote/quote';

import {InlineCode} from 'sentry/components/core/code';
import {Stack, type StackProps} from 'sentry/components/core/layout';
import type {TextProps} from 'sentry/components/core/text/text';
import {Text} from 'sentry/components/core/text/text';
import * as Stories from 'sentry/stories';

import {StoryHeading} from './storyHeading';

type HeadingProps = {
  children: React.ReactNode;
};

const calloutToAlertType: Record<string, AlertProps['variant']> = {
  tip: 'muted',
  note: 'info',
  important: 'success',
  warning: 'warning',
  caution: 'danger',
};

// Heading levels shifted N+1 for proper semantics on /stories pages
export const storyMdxComponents = {
  h1: (props: HeadingProps) => <StoryHeading as="h2" size="2xl" {...props} />,
  h2: (props: HeadingProps) => <StoryHeading as="h3" size="xl" {...props} />,
  h3: (props: HeadingProps) => <StoryHeading as="h4" size="lg" {...props} />,
  h4: (props: HeadingProps) => <StoryHeading as="h5" size="md" {...props} />,
  h5: (props: HeadingProps) => <StoryHeading as="h6" size="sm" {...props} />,
  h6: (props: HeadingProps) => <StoryHeading as="h6" size="xs" {...props} />,
  code: (props: HTMLProps<HTMLElement>) => <InlineCode {...props} />,
  Callout: (props: PropsWithChildren<CalloutProps>) => {
    const children = React.Children.toArray(props.children).filter(value => {
      if (React.isValidElement(value)) {
        if (value.props && typeof value.props === 'object') {
          // data-callout-title child added by @r4ai/remark-callout
          // but we want to style `props.title` differently
          return !('data-callout-title' in value.props);
        }
      }
      return true;
    });
    const expand = props.isFoldable ? children : undefined;
    return (
      <Alert
        variant={calloutToAlertType[props.type.toLowerCase()] ?? 'muted'}
        expand={expand}
        defaultExpanded={!props.defaultFolded}
      >
        <strong>{props.title}</strong>
        {props.isFoldable ? null : children}
      </Alert>
    );
  },
  p: (props: TextProps<'p'>) => (
    <Text as="p" size="md" density="comfortable" {...props} />
  ),
  ul: (props: Pick<StackProps<'ul'>, 'as'>) => (
    <Stack margin="0" {...props} as="ul" gap="lg" />
  ),
  blockquote: (props: QuoteProps) => <Quote {...props} />,
  table: Stories.Table,
};
