import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

interface QuoteProps extends React.HTMLProps<HTMLElementTagNameMap['blockquote']> {
  source?: {
    href?: string;
    label?: string;
    person?: string;
  };
}
export function Quote(props: QuoteProps) {
  return (
    <Stack as="figure" paddingLeft="xl" marginLeft="lg" borderLeft="primary">
      <Blockquote cite={props.source?.href} {...props} as="blockquote" />
      {props.source ? (
        <figcaption>
          <Text as="p">
            {props.source.person}
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

const Blockquote = styled('blockquote')`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;
`;
