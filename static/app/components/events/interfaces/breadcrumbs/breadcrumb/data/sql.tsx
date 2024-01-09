import styled from '@emotion/styled';

import Highlight from 'sentry/components/highlight';
import {prismStyles} from 'sentry/styles/prism';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeNavigation | BreadcrumbTypeDefault;
  searchTerm: string;
};

export function Sql({breadcrumb, searchTerm}: Props) {
  const {data, message} = breadcrumb;
  const tokens = usePrismTokens({code: message ?? '', language: 'sql'});

  return (
    <Summary kvData={data}>
      <Wrapper>
        <pre className="language-sql">
          <code>
            {tokens.map((line, i) => (
              <div key={i}>
                <div>
                  {line.map((token, j) => (
                    <span key={j} className={token.className}>
                      <Highlight text={searchTerm}>{token.children}</Highlight>
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
