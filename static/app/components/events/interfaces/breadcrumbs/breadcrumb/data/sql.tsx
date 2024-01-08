import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import {prismStyles} from 'sentry/styles/prism';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeNavigation | BreadcrumbTypeDefault;
  searchTerm: string;
  meta?: Record<any, any>;
};

export function Sql({breadcrumb, meta, searchTerm}: Props) {
  const {data, message} = breadcrumb;
  /**
   * Normalize the message by replacing '...' with '\n\u2026' and '[Filtered]' with 'Filtered'.
   * This is done to ensure '.' and '[]' are NOT labeled as punctuation by usePrismTokens
   * and instead are special cases where we apply AnnotatedText
   */
  const messageFormatted = message?.replace(/\.\.\.|(\[Filtered\])/g, (_match, p1) => {
    return p1 ? 'Filtered' : '\n\u2026';
  });

  /**
   * If annotated text is a size limit tooltip, we need to remove the extra copy of the text
   * from the meta.
   */
  meta?.message?.[''].chunks?.forEach(element => {
    if (element.type === 'text') {
      delete element.text;
    }
  });

  const tokens = usePrismTokens({code: messageFormatted!, language: 'sql'});

  return (
    <Summary kvData={data} meta={meta}>
      <Wrapper>
        <pre className="language-sql">
          <code>
            {tokens.map((line, i) => (
              <div key={i}>
                <div>
                  {line.map((token, j) => (
                    <span key={j} className={token.className}>
                      {token.children === '\u2026' || token.children === 'Filtered' ? (
                        <AnnotatedText
                          value={
                            // Puts the '[]' back if 'Filtered' present
                            token.children === '\u2026' ? '...' : '[Filtered]'
                          }
                          meta={meta?.message?.['']}
                        />
                      ) : (
                        <Highlight text={searchTerm}>{token.children}</Highlight>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </code>
        </pre>
      </Wrapper>
    </Summary>
  );
}

const Wrapper = styled('div')`
  background: var(--prism-block-background);

  ${p => prismStyles(p.theme)}

  pre {
    margin: 0;
    padding: 0;
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;
