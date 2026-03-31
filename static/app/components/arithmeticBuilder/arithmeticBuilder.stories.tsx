import {Fragment, useState} from 'react';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ArithmeticBuilder', story => {
  story('With References', () => {
    const [expression, setExpression] = useState('A + B');
    const [refsInput, setRefsInput] = useState('["A", "B", "C"]');
    const [parseError, setParseError] = useState('');

    let references = new Set<string>();
    try {
      const parsed = JSON.parse(refsInput);
      references = new Set(parsed);
      if (parseError) {
        setParseError('');
      }
    } catch (e) {
      if (!parseError) {
        setParseError(String(e));
      }
    }

    return (
      <Fragment>
        <p>
          Define references as a JSON array of single uppercase letters below, then use
          them in the expression.
        </p>

        <label htmlFor="refs-input">
          References JSON
          <textarea
            id="refs-input"
            value={refsInput}
            onChange={e => setRefsInput(e.target.value)}
            rows={3}
            style={{width: '100%', fontFamily: 'monospace', marginBottom: 8}}
          />
        </label>

        {parseError ? <p style={{color: 'red'}}>{parseError}</p> : null}

        <ArithmeticBuilder
          expression={expression}
          setExpression={expr => setExpression(expr.text)}
          references={references}
          aggregations={[]}
          functionArguments={[]}
          getFieldDefinition={() => null}
        />

        <p style={{marginTop: 8, fontFamily: 'monospace'}}>Expression: {expression}</p>
      </Fragment>
    );
  });
});
