import {RuleTester} from '@typescript-eslint/rule-tester';

import {preferInfoText} from './prefer-info-text';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('prefer-info-text', preferInfoText, {
  valid: [
    {
      name: 'Tooltip wrapping a non-text component',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="help"><IconInfo /></Tooltip>;
      `,
    },
    {
      name: 'Tooltip wrapping mixed text and non-text children',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="help"><span>text</span><IconInfo /></Tooltip>;
      `,
    },
    {
      name: 'Self-closing Tooltip',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="help" />;
      `,
    },
    {
      name: 'Tooltip from a different package',
      code: `
        import {Tooltip} from 'other-package';
        const x = <Tooltip title="x">text</Tooltip>;
      `,
    },
    {
      name: 'Tooltip wrapping a styled component (not detectable)',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><StyledLabel>text</StyledLabel></Tooltip>;
      `,
    },
    {
      name: 'Tooltip wrapping a div',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><div>text</div></Tooltip>;
      `,
    },
    {
      name: 'Tooltip wrapping a variable reference',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{someVariable}</Tooltip>;
      `,
    },
    {
      name: 'Tooltip wrapping a complex component child',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><Button>{t('click')}</Button></Tooltip>;
      `,
    },
    {
      name: 'No Tooltip import at all',
      code: `
        const Tooltip = (props: any) => null;
        const x = <Tooltip title="x">text</Tooltip>;
      `,
    },
  ],

  invalid: [
    {
      name: 'Raw text child',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="explanation">Some text here</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 't() i18n call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title={description}>{t('Click to expand')}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'tct() i18n call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title={desc}>{tct('Hello [name]', {name})}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'String literal in expression container',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{'some string'}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Template literal',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{\`hello \${name}\`}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'span wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><span>label text</span></Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'span wrapping t() call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><span>{t('label')}</span></Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Text component wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {Text} from '@sentry/scraps/text';
        const x = <Tooltip title="x"><Text>label</Text></Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Tooltip with extra props still flagged',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x" showUnderline disabled>{t('label')}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Multiple text-like children',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">Hello {t('world')}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Aliased Tooltip import',
      code: `
        import {Tooltip as Tip} from '@sentry/scraps/tooltip';
        const x = <Tip title="x">{t('label')}</Tip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Fragment wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><>{t('label')}</></Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Conditional expression with text branches',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{condition ? t('a') : t('b')}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Logical AND with text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{condition && t('label')}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
  ],
});
