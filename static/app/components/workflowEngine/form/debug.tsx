import {usePrismTokens} from 'sentry/utils/usePrismTokens';

import {useFormFields} from './hooks';

export function DebugForm() {
  const form = useFormFields();
  const tokens = usePrismTokens({code: JSON.stringify(form, null, 2), language: 'json'});
  return (
    <pre className="language-json">
      <code>
        {tokens.map(line => (
          <div key={line.map(token => token.children).join('')}>
            {line.map((token, i) => (
              <span key={`token-${i}`} className={token.className}>
                {token.children}
              </span>
            ))}
          </div>
        ))}
      </code>
    </pre>
  );
}
