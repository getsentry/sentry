import {RuleTester} from '@typescript-eslint/rule-tester';

import {noUnnecessaryUseCallback} from './no-unnecessary-use-callback';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('no-unnecessary-use-callback', noUnnecessaryUseCallback, {
  valid: [
    {
      name: 'useCallback passed directly to custom component',
      code: `
        const fn = useCallback(() => {
          console.log('click');
        }, []);
        <MyComponent onClick={fn} />
      `,
    },
    {
      name: 'regular function passed to intrinsic element',
      code: `
        const fn = () => console.log('click');
        <button onClick={fn} />
      `,
    },
    {
      name: 'regular function wrapped in arrow on intrinsic element',
      code: `
        const fn = () => console.log('click');
        <button onClick={() => fn()} />
      `,
    },
    {
      name: 'inline arrow on intrinsic element without useCallback',
      code: `
        <button onClick={() => console.log('click')} />
      `,
    },
    {
      name: 'useCallback used in dependency array',
      code: `
        const fn = useCallback(() => {}, []);
        useEffect(() => { fn() }, [fn]);
      `,
    },
    {
      name: 'useCallback result used in non-JSX context',
      code: `
        const fn = useCallback(() => {}, []);
        someFunction(fn);
      `,
    },
    {
      name: 'arrow wrapping a call to a different function',
      code: `
        const fn = useCallback(() => {}, []);
        <button onClick={() => otherFn()} />
      `,
    },
    {
      name: 'useCallback passed directly to namespaced custom component',
      code: `
        const fn = useCallback(() => {}, []);
        <Namespace.Component onClick={fn} />
      `,
    },
    {
      name: 'arrow body calls non-useCallback function',
      code: `
        const fn = useCallback(() => {}, []);
        <button onClick={() => { doSomethingElse(); }} />
      `,
    },
    {
      name: 'useCallback justified by custom component usage alongside direct invocation',
      code: `
        const fn = useCallback(() => {}, []);
        <><MyComponent onClick={fn} /><button onClick={() => fn()} /></>
      `,
    },
    {
      name: 'useCallback justified by custom component usage alongside intrinsic element',
      code: `
        const fn = useCallback(() => {}, []);
        <><MyComponent onClick={fn} /><button onClick={fn} /></>
      `,
    },
    {
      name: 'useCallback passed as callback ref to intrinsic element',
      code: `
        const fn = useCallback((node) => {
          if (node) node.focus();
        }, []);
        <input ref={fn} />
      `,
    },
    {
      name: 'useCallback used in useEffect dependency array alongside intrinsic element',
      code: `
        const fn = useCallback(() => {}, []);
        useEffect(() => { fn() }, [fn]);
        <button onClick={fn} />
      `,
    },
    {
      name: 'useCallback used in any other expression alongside direct invocation',
      code: `
        const fn = useCallback(() => {}, []);
        console.log(fn);
        <button onClick={() => fn()} />
      `,
    },
    {
      name: 'useCallback passed to scraps component justified by other usage',
      code: `
        import {Button} from '@sentry/scraps/button';
        const fn = useCallback(() => {}, []);
        console.log(fn);
        <Button onClick={fn} />
      `,
    },
    {
      name: 'useCallback passed to excluded scraps component CompactSelect',
      code: `
        import {CompactSelect} from '@sentry/scraps/compactSelect';
        const fn = useCallback(() => {}, []);
        <CompactSelect onChange={fn} />
      `,
    },
    {
      name: 'useCallback passed to excluded scraps component CodeBlock',
      code: `
        import {CodeBlock} from '@sentry/scraps/codeBlock';
        const fn = useCallback(() => {}, []);
        <CodeBlock onCopy={fn} />
      `,
    },
    {
      name: 'bug: shadowed callee inside arrow',
      code: `
        const fn = useCallback(() => {}, []);
        (() => {
          const fn = () => {};
          return <button onClick={() => fn()} />;
        })();
      `,
    },
    {
      name: 'bug: shadowed identifier on direct prop',
      code: `
        const fn = useCallback(() => {}, []);
        (() => {
          const fn = () => {};
          return <button onClick={fn} />;
        })();
      `,
    },
  ],

  invalid: [
    {
      name: 'arrow wrap on intrinsic element',
      code: `
        const fn = useCallback(() => { console.log('click'); }, []);
        <button onClick={() => fn()} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {name: 'fn', usages: 'directly invoked in line 3'},
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => { console.log('click'); };
        <button onClick={() => fn()} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'arrow wrap on custom component',
      code: `
        const fn = useCallback(() => { console.log('click'); }, []);
        <MyComponent onClick={() => fn()} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {name: 'fn', usages: 'directly invoked in line 3'},
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => { console.log('click'); };
        <MyComponent onClick={() => fn()} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'arrow wrap with argument forwarding',
      code: `
        const fn = useCallback((e) => { console.log(e); }, []);
        <button onClick={(e) => fn(e)} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {name: 'fn', usages: 'directly invoked in line 3'},
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = (e) => { console.log(e); };
        <button onClick={(e) => fn(e)} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'direct reference on <button>',
      code: `
        const fn = useCallback((e) => { console.log('click'); }, []);
        <button onClick={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to intrinsic element <button> in line 3',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = (e) => { console.log('click'); };
        <button onClick={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'direct reference on <div>',
      code: `
        const fn = useCallback(() => {}, []);
        <div onMouseEnter={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to intrinsic element <div> in line 3',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => {};
        <div onMouseEnter={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'direct reference on <input>',
      code: `
        const fn = useCallback(() => {}, []);
        <input onChange={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to intrinsic element <input> in line 3',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => {};
        <input onChange={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'direct reference on <a>',
      code: `
        const fn = useCallback(() => {}, []);
        <a onClick={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to intrinsic element <a> in line 3',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => {};
        <a onClick={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'arrow wrap with multiple arguments',
      code: `
        const handler = useCallback((a, b) => {}, []);
        <button onClick={(a, b) => handler(a, b)} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {name: 'handler', usages: 'directly invoked in line 3'},
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const handler = (a, b) => {};
        <button onClick={(a, b) => handler(a, b)} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'useCallback called inside block-body arrow with additional logic',
      code: `
        const fn = useCallback(() => {}, []);
        <button onClick={() => { fn(); doSomethingElse(); }} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {name: 'fn', usages: 'directly invoked in line 3'},
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => {};
        <button onClick={() => { fn(); doSomethingElse(); }} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'multiple flagged usages reported together',
      code: `
        const fn = useCallback(() => {}, []);
        <><button onClick={() => fn()} /><div onMouseEnter={fn} /></>
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages:
              'directly invoked in line 3 and passed to intrinsic element <div> in line 3',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        const fn = () => {};
        <><button onClick={() => fn()} /><div onMouseEnter={fn} /></>
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'useCallback passed to @sentry/scraps component',
      code: `
        import {Button} from '@sentry/scraps/button';
        const fn = useCallback(() => {}, []);
        <Button onClick={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to unmemoized component <Button> in line 4',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        import {Button} from '@sentry/scraps/button';
        const fn = () => {};
        <Button onClick={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'useCallback passed to @sentry/scraps namespaced component',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const fn = useCallback(() => {}, []);
        <Flex onClick={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to unmemoized component <Flex> in line 4',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        import {Flex} from '@sentry/scraps/layout';
        const fn = () => {};
        <Flex onClick={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'bug: aliased useCallback import should still be tracked',
      code: `
        import {useCallback as uc} from 'react';
        const fn = uc(() => {}, []);
        <button onClick={fn} />
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to intrinsic element <button> in line 4',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        import {useCallback as uc} from 'react';
        const fn = () => {};
        <button onClick={fn} />
      `,
            },
          ],
        },
      ],
    },
    {
      name: 'bug: same binding name in sibling functions only flags the intrinsic one',
      code: `
        function B() {
          const fn = useCallback(() => {}, []);
          return <button onClick={fn} />;
        }
        function A() {
          const fn = useCallback(() => {}, []);
          return <Memo onClick={fn} />;
        }
      `,
      errors: [
        {
          messageId: 'unnecessaryUseCallback',
          data: {
            name: 'fn',
            usages: 'passed to intrinsic element <button> in line 4',
          },
          suggestions: [
            {
              messageId: 'removeUseCallback',
              output: `
        function B() {
          const fn = () => {};
          return <button onClick={fn} />;
        }
        function A() {
          const fn = useCallback(() => {}, []);
          return <Memo onClick={fn} />;
        }
      `,
            },
          ],
        },
      ],
    },
  ],
});
