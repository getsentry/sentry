import React from 'react';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {
  contentBlockToMarkdown,
  reactNodeToText,
  simpleHtmlToMarkdown,
  stepsToMarkdown,
  stepsToText,
} from './stepsToMarkdown';

describe('simpleHtmlToMarkdown', () => {
  it('converts anchor tags to markdown links', () => {
    expect(simpleHtmlToMarkdown('<a href="https://sentry.io">Sentry</a>')).toBe(
      '[Sentry](https://sentry.io)'
    );
  });

  it('converts strong and b tags to bold', () => {
    expect(simpleHtmlToMarkdown('<strong>bold text</strong>')).toBe('**bold text**');
    expect(simpleHtmlToMarkdown('<b>bold text</b>')).toBe('**bold text**');
  });

  it('converts em and i tags to italic', () => {
    expect(simpleHtmlToMarkdown('<em>italic text</em>')).toBe('*italic text*');
    expect(simpleHtmlToMarkdown('<i>italic text</i>')).toBe('*italic text*');
  });

  it('converts code tags to inline code', () => {
    expect(simpleHtmlToMarkdown('<code>npm install</code>')).toBe('`npm install`');
  });

  it('converts p tags to text with double newline', () => {
    expect(simpleHtmlToMarkdown('<p>First paragraph</p><p>Second paragraph</p>')).toBe(
      'First paragraph\n\nSecond paragraph'
    );
  });

  it('converts br tags to newlines', () => {
    expect(simpleHtmlToMarkdown('line one<br>line two')).toBe('line one\nline two');
    expect(simpleHtmlToMarkdown('line one<br/>line two')).toBe('line one\nline two');
    expect(simpleHtmlToMarkdown('line one<br />line two')).toBe('line one\nline two');
  });

  it('converts unordered lists', () => {
    const html = '<ul><li>item one</li><li>item two</li></ul>';
    const result = simpleHtmlToMarkdown(html);
    expect(result).toContain('- item one');
    expect(result).toContain('- item two');
  });

  it('converts ordered lists', () => {
    const html = '<ol><li>first</li><li>second</li></ol>';
    const result = simpleHtmlToMarkdown(html);
    expect(result).toContain('1. first');
    expect(result).toContain('2. second');
  });

  it('converts div tags to text with newline', () => {
    expect(simpleHtmlToMarkdown('<div>content</div>')).toBe('content');
  });

  it('strips unknown tags and keeps inner text', () => {
    expect(simpleHtmlToMarkdown('<span>some text</span>')).toBe('some text');
    expect(simpleHtmlToMarkdown('<custom>inner</custom>')).toBe('inner');
  });

  it('decodes HTML entities', () => {
    expect(simpleHtmlToMarkdown('&amp; &lt; &gt; &quot; &#x27;')).toBe('& < > " \'');
  });

  it('handles nested HTML', () => {
    const html =
      '<p>Use <code>sentry-sdk</code> to <strong>initialize</strong> Sentry.</p>';
    expect(simpleHtmlToMarkdown(html)).toBe('Use `sentry-sdk` to **initialize** Sentry.');
  });

  it('converts pre>code blocks to fenced code blocks', () => {
    const html =
      '<pre class="language-python"><code class="language-python">import sentry_sdk\nsentry_sdk.init()</code></pre>';
    expect(simpleHtmlToMarkdown(html)).toBe(
      '```python\nimport sentry_sdk\nsentry_sdk.init()\n```'
    );
  });

  it('converts pre>code blocks without language class', () => {
    const html = '<pre><code>echo "hello"</code></pre>';
    expect(simpleHtmlToMarkdown(html)).toBe('```\necho "hello"\n```');
  });

  it('handles pre>code blocks alongside inline code', () => {
    const html =
      '<p>Run <code>npm install</code> then add:</p><pre class="language-javascript"><code class="language-javascript">const x = 1;</code></pre>';
    const result = simpleHtmlToMarkdown(html);
    expect(result).toContain('`npm install`');
    expect(result).toContain('```javascript\nconst x = 1;\n```');
  });

  it('handles empty string', () => {
    expect(simpleHtmlToMarkdown('')).toBe('');
  });
});

describe('reactNodeToText', () => {
  it('returns empty string for null and undefined', () => {
    expect(reactNodeToText(null)).toBe('');
    expect(reactNodeToText(undefined)).toBe('');
  });

  it('returns empty string for booleans', () => {
    expect(reactNodeToText(true)).toBe('');
    expect(reactNodeToText(false)).toBe('');
  });

  it('returns string as-is', () => {
    expect(reactNodeToText('hello world')).toBe('hello world');
  });

  it('returns number as string', () => {
    expect(reactNodeToText(42)).toBe('42');
  });

  it('converts React element with anchor to markdown link', () => {
    const element = React.createElement('a', {href: 'https://example.com'}, 'link text');
    expect(reactNodeToText(element)).toBe('[link text](https://example.com)');
  });

  it('converts React element with bold to markdown', () => {
    const element = React.createElement('strong', null, 'important');
    expect(reactNodeToText(element)).toBe('**important**');
  });

  it('converts React element with nested content', () => {
    const element = React.createElement(
      'p',
      null,
      'Install the ',
      React.createElement('code', null, '@sentry/node'),
      ' package.'
    );
    expect(reactNodeToText(element)).toBe('Install the `@sentry/node` package.');
  });
});

describe('contentBlockToMarkdown', () => {
  it('converts TextBlock', () => {
    const block: ContentBlock = {
      type: 'text',
      text: 'Install the Sentry SDK.',
    };
    expect(contentBlockToMarkdown(block)).toBe('Install the Sentry SDK.');
  });

  it('converts TextBlock with React content', () => {
    const block: ContentBlock = {
      type: 'text',
      text: React.createElement(
        'p',
        null,
        'See the ',
        React.createElement('a', {href: 'https://docs.sentry.io'}, 'docs'),
        '.'
      ),
    };
    expect(contentBlockToMarkdown(block)).toBe('See the [docs](https://docs.sentry.io).');
  });

  it('converts single CodeBlock', () => {
    const block: ContentBlock = {
      type: 'code',
      code: 'npm install @sentry/node',
      language: 'bash',
    };
    const result = contentBlockToMarkdown(block);
    expect(result).toBe('```bash\nnpm install @sentry/node\n```');
  });

  it('converts single CodeBlock with filename', () => {
    const block: ContentBlock = {
      type: 'code',
      code: 'import * as Sentry from "@sentry/node";',
      language: 'javascript',
      filename: 'app.js',
    };
    const result = contentBlockToMarkdown(block);
    expect(result).toContain('```javascript');
    expect(result).toContain('// app.js');
    expect(result).toContain('import * as Sentry from "@sentry/node";');
  });

  it('converts tabbed CodeBlock', () => {
    const block: ContentBlock = {
      type: 'code',
      tabs: [
        {code: 'npm install @sentry/node', language: 'bash', label: 'npm'},
        {code: 'yarn add @sentry/node', language: 'bash', label: 'yarn'},
      ],
    };
    const result = contentBlockToMarkdown(block);
    expect(result).toContain('**npm**');
    expect(result).toContain('```bash\nnpm install @sentry/node\n```');
    expect(result).toContain('**yarn**');
    expect(result).toContain('```bash\nyarn add @sentry/node\n```');
  });

  it('converts AlertBlock', () => {
    const block: ContentBlock = {
      type: 'alert',
      alertType: 'info',
      text: 'This is important.',
    };
    expect(contentBlockToMarkdown(block)).toBe('> **Note:** This is important.');
  });

  it('converts SubHeaderBlock', () => {
    const block: ContentBlock = {
      type: 'subheader',
      text: 'Configuration Options',
    };
    expect(contentBlockToMarkdown(block)).toBe('### Configuration Options');
  });

  it('converts ListBlock', () => {
    const block: ContentBlock = {
      type: 'list',
      items: ['First item', 'Second item', 'Third item'],
    };
    const result = contentBlockToMarkdown(block);
    expect(result).toBe('- First item\n- Second item\n- Third item');
  });

  it('converts ConditionalBlock when condition is true', () => {
    const block: ContentBlock = {
      type: 'conditional',
      condition: true,
      content: [
        {type: 'text', text: 'Visible content'},
        {type: 'code', code: 'console.log("hello")', language: 'javascript'},
      ],
    };
    const result = contentBlockToMarkdown(block);
    expect(result).toContain('Visible content');
    expect(result).toContain('```javascript');
  });

  it('returns empty string for ConditionalBlock when condition is false', () => {
    const block: ContentBlock = {
      type: 'conditional',
      condition: false,
      content: [{type: 'text', text: 'Hidden content'}],
    };
    expect(contentBlockToMarkdown(block)).toBe('');
  });

  it('converts CustomBlock with string content', () => {
    const block: ContentBlock = {
      type: 'custom',
      content: 'Custom content here',
    };
    expect(contentBlockToMarkdown(block)).toBe('Custom content here');
  });

  it('converts CustomBlock with React element content', () => {
    const block: ContentBlock = {
      type: 'custom',
      content: React.createElement('div', null, 'Custom React content'),
    };
    const result = contentBlockToMarkdown(block);
    expect(result).toContain('Custom React content');
  });
});

describe('stepsToMarkdown', () => {
  it('converts steps with StepType to markdown', () => {
    const steps: OnboardingStep[] = [
      {
        type: StepType.INSTALL,
        content: [
          {type: 'text', text: 'Install the SDK.'},
          {type: 'code', code: 'npm install @sentry/node', language: 'bash'},
        ],
      },
      {
        type: StepType.CONFIGURE,
        content: [
          {type: 'text', text: 'Configure Sentry in your app.'},
          {
            type: 'code',
            code: 'Sentry.init({ dsn: "your-dsn" })',
            language: 'javascript',
          },
        ],
      },
      {
        type: StepType.VERIFY,
        content: [{type: 'text', text: 'Trigger an error to verify.'}],
      },
    ];

    const result = stepsToMarkdown(steps);

    expect(result).toContain('## Install');
    expect(result).toContain('Install the SDK.');
    expect(result).toContain('```bash\nnpm install @sentry/node\n```');

    expect(result).toContain('## Configure');
    expect(result).toContain('Configure Sentry in your app.');

    expect(result).toContain('## Verify');
    expect(result).toContain('Trigger an error to verify.');
  });

  it('converts steps with custom titles', () => {
    const steps: OnboardingStep[] = [
      {
        title: 'Getting Started',
        content: [{type: 'text', text: 'Welcome to Sentry.'}],
      },
    ];

    const result = stepsToMarkdown(steps);
    expect(result).toContain('## Getting Started');
    expect(result).toContain('Welcome to Sentry.');
  });

  it('handles empty steps array', () => {
    expect(stepsToMarkdown([])).toBe('');
  });

  it('handles mixed content blocks in a single step', () => {
    const steps: OnboardingStep[] = [
      {
        type: StepType.INSTALL,
        content: [
          {type: 'text', text: 'First, install the package:'},
          {type: 'code', code: 'pip install sentry-sdk', language: 'bash'},
          {type: 'alert', alertType: 'warning', text: 'Requires Python 3.6+'},
          {type: 'subheader', text: 'Optional Dependencies'},
          {type: 'list', items: ['flask', 'django', 'celery']},
        ],
      },
    ];

    const result = stepsToMarkdown(steps);
    expect(result).toContain('## Install');
    expect(result).toContain('First, install the package:');
    expect(result).toContain('```bash\npip install sentry-sdk\n```');
    expect(result).toContain('> **Note:** Requires Python 3.6+');
    expect(result).toContain('### Optional Dependencies');
    expect(result).toContain('- flask\n- django\n- celery');
  });

  it('skips false conditional blocks', () => {
    const steps: OnboardingStep[] = [
      {
        type: StepType.CONFIGURE,
        content: [
          {type: 'text', text: 'Always visible'},
          {
            type: 'conditional',
            condition: false,
            content: [{type: 'text', text: 'Should not appear'}],
          },
          {type: 'text', text: 'Also visible'},
        ],
      },
    ];

    const result = stepsToMarkdown(steps);
    expect(result).toContain('Always visible');
    expect(result).not.toContain('Should not appear');
    expect(result).toContain('Also visible');
  });
});

describe('stepsToText', () => {
  it('strips markdown formatting but preserves code blocks', () => {
    const steps: OnboardingStep[] = [
      {
        type: StepType.INSTALL,
        content: [
          {type: 'text', text: 'Install the SDK.'},
          {type: 'code', code: 'npm install @sentry/node', language: 'bash'},
        ],
      },
    ];

    const result = stepsToText(steps);

    // Heading markers should be stripped
    expect(result).not.toMatch(/^##\s/m);
    expect(result).toContain('Install');

    // Code blocks should be preserved
    expect(result).toContain('```bash\nnpm install @sentry/node\n```');
  });

  it('strips bold, italic, and link formatting', () => {
    const steps: OnboardingStep[] = [
      {
        title: 'Setup',
        content: [
          {
            type: 'text',
            text: React.createElement(
              'p',
              null,
              'Read the ',
              React.createElement('a', {href: 'https://docs.sentry.io'}, 'documentation'),
              ' for ',
              React.createElement('strong', null, 'detailed'),
              ' instructions.'
            ),
          },
        ],
      },
    ];

    const result = stepsToText(steps);
    // Links should be converted to just text
    expect(result).toContain('documentation');
    expect(result).not.toContain('[documentation]');
    expect(result).not.toContain('https://docs.sentry.io');

    // Bold should be stripped
    expect(result).toContain('detailed');
    expect(result).not.toContain('**detailed**');
  });

  it('strips blockquote markers from alerts', () => {
    const steps: OnboardingStep[] = [
      {
        title: 'Note',
        content: [{type: 'alert', alertType: 'info', text: 'Important info'}],
      },
    ];

    const result = stepsToText(steps);
    expect(result).toContain('Important info');
    expect(result).not.toMatch(/^>\s/m);
  });

  it('handles empty steps array', () => {
    expect(stepsToText([])).toBe('');
  });
});
