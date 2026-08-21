import {RuleTester} from '@typescript-eslint/rule-tester';

import {noTrustedTypesSinks} from './noTrustedTypesSinks';

const ruleTester = new RuleTester();

ruleTester.run('no-trusted-types-sinks', noTrustedTypesSinks, {
  valid: [
    // Sanitizer calls are the supported way to feed a sink
    {
      code: '<div dangerouslySetInnerHTML={{__html: sanitizeHtml(raw)}} />',
      filename: 'file.tsx',
    },
    {
      code: '<div dangerouslySetInnerHTML={{__html: singleLineRenderer(text)}} />',
      filename: 'file.tsx',
    },
    {
      code: '<div dangerouslySetInnerHTML={{__html: sanitizedMarked(body)}} />',
      filename: 'file.tsx',
    },
    {
      code: '<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(note, {})}} />',
      filename: 'file.tsx',
    },
    // A local const holding a sanitizer result resolves through
    {
      code: 'const sanitized = sanitizeHtml(raw); const el = <div dangerouslySetInnerHTML={{__html: sanitized}} />;',
      filename: 'file.tsx',
    },
    // Not sinks: only <script> makes these dangerous, only document has write
    {code: 'div.textContent = userInput;', filename: 'file.ts'},
    {code: 'img.src = url;', filename: 'file.ts'},
    {code: 'iframe.src = url;', filename: 'file.ts'},
    {code: 'stream.write(chunk);', filename: 'file.ts'},
    {code: 'logger.writeln(msg);', filename: 'file.ts'},
    // Reading is not a sink
    {code: 'const html = el.innerHTML;', filename: 'file.ts'},
    // Sanitized assignment is allowed
    {code: 'el.innerHTML = sanitizeHtml(raw);', filename: 'file.ts'},
  ],
  invalid: [
    // Values the rule cannot see into must be reported, not assumed safe
    {
      code: '<div dangerouslySetInnerHTML={getHelp()} />',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    {
      code: '<div dangerouslySetInnerHTML={htmlProps} />',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    {
      code: '<div dangerouslySetInnerHTML={{...getHelp()}} />',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    {
      code: '<div dangerouslySetInnerHTML={{__html: rawHtmlString}} />',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    {
      code: '<div dangerouslySetInnerHTML={{__html: `<b>${name}</b>`}} />',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    // A let, or a const not initialized from a sanitizer, does not resolve
    {
      code: 'let sanitized = sanitizeHtml(raw); const el = <div dangerouslySetInnerHTML={{__html: sanitized}} />;',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    {
      code: 'const notSafe = someOtherFn(raw); const el = <div dangerouslySetInnerHTML={{__html: notSafe}} />;',
      filename: 'file.tsx',
      errors: [{messageId: 'jsxSink'}],
    },
    {
      code: 'el.innerHTML = userInput;',
      filename: 'file.ts',
      errors: [{messageId: 'assignmentSink'}],
    },
    {
      code: "el.innerHTML = '';",
      filename: 'file.ts',
      errors: [{messageId: 'assignmentSink'}],
    },
    {
      code: 'el.outerHTML = userInput;',
      filename: 'file.ts',
      errors: [{messageId: 'assignmentSink'}],
    },
    {
      code: 'frame.srcdoc = userInput;',
      filename: 'file.ts',
      errors: [{messageId: 'assignmentSink'}],
    },
    {
      code: "el.insertAdjacentHTML('beforeend', userInput);",
      filename: 'file.ts',
      errors: [{messageId: 'callSink'}],
    },
    {
      code: 'document.write(userInput);',
      filename: 'file.ts',
      errors: [{messageId: 'callSink'}],
    },
    {
      code: 'iframe.document.write(codes.join("<br>"));',
      filename: 'file.ts',
      errors: [{messageId: 'callSink'}],
    },
    {
      code: "new DOMParser().parseFromString(html, 'text/html');",
      filename: 'file.ts',
      errors: [{messageId: 'callSink'}],
    },
    {
      code: "range.createContextualFragment('<b>x</b>');",
      filename: 'file.ts',
      errors: [{messageId: 'callSink'}],
    },
    // <script> element writes are TrustedScript sinks
    {
      code: "queueScript.textContent = 'window.x = 1';",
      filename: 'file.ts',
      errors: [{messageId: 'scriptSink'}],
    },
    {
      code: "mainScript.text = 'window.x = 1';",
      filename: 'file.ts',
      errors: [{messageId: 'scriptSink'}],
    },
    {
      code: "mainScript.src = 'https://plausible.io/js/script.js';",
      filename: 'file.ts',
      errors: [{messageId: 'scriptSink'}],
    },
  ],
});
