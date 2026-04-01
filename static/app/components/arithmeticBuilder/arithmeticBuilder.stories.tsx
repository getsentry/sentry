import {Fragment, useCallback, useEffect, useState} from 'react';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ArithmeticBuilder', story => {
  story('With References', () => {
    const [expression, setExpression] = useState('A + B + Gamma');
    const [isValid, setIsValid] = useState(true);
    const [references, setReferences] = useState(
      new Set<string>(['A', 'B', 'C', 'Gamma'])
    );
    const [parseError, setParseError] = useState('');

    const onExpressionChange = useCallback((expr: Expression) => {
      setExpression(expr.text);
    }, []);

    // Expicitly check the new expression for validity since references
    // changing is a responibility of the caller.
    useEffect(() => {
      setIsValid(new Expression(expression, references).isValid);
    }, [expression, references]);

    return (
      <Fragment>
        <p>
          Define references as a JSON array of strings below, then use them in the
          expression. If references are present, then they will take priority over
          aggregations and only suggest references and operators when typing.
        </p>

        <p>
          If a character appears that is not a reference, then it will be treated as a
          free text token.
        </p>

        <p>
          If during typing, the string matches a single reference, we will automatically
          select that reference. Otherwise we will continue to suggest references since
          there are multiple options.
        </p>

        <label htmlFor="refs-input">
          References JSON
          <textarea
            id="refs-input"
            defaultValue={JSON.stringify([...references])}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                setReferences(new Set(parsed));
                setParseError('');
              } catch (error) {
                setParseError(String(error));
              }
            }}
            rows={3}
            style={{width: '100%', fontFamily: 'monospace', marginBottom: 8}}
          />
        </label>

        {parseError ? <p style={{color: 'red'}}>{parseError}</p> : null}

        <ArithmeticBuilder
          expression={expression}
          setExpression={onExpressionChange}
          references={references}
          aggregations={[]}
          functionArguments={[]}
          getFieldDefinition={() => null}
        />

        <div style={{marginTop: 8, fontFamily: 'monospace'}}>
          <p>Expression: {expression}</p>
          <p>
            Valid:{' '}
            <span style={{color: isValid ? 'green' : 'red'}}>
              {isValid ? 'yes' : 'no'}
            </span>
          </p>
        </div>
      </Fragment>
    );
  });
});
