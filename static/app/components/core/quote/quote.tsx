import {Fragment} from 'react';
import {css, useTheme, type Theme} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

const quoteStyles = (_theme: Theme) => css`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;
`;

interface QuoteProps extends React.HTMLProps<HTMLElementTagNameMap['blockquote']> {
  source?: {
    href?: string;
    label?: string;
    person?: string;
  };
}
export function Quote(props: QuoteProps) {
  const theme = useTheme();
  return (
    <Stack as="figure" paddingLeft="xl" marginLeft="lg" borderLeft="primary">
      <blockquote css={quoteStyles(theme)} cite={props.source?.href} {...props} />
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
