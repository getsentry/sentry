import Highlight from 'sentry/components/highlight';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

import Summary from './summary';

type Props = {
  message: string;
  searchTerm: string;
};

export function Sql({message, searchTerm}: Props) {
  const tokens = usePrismTokens({code: message, language: 'sql'});
  return (
    <Summary>
      <pre className="language-sql">
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
      </pre>
    </Summary>
  );
}
