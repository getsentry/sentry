import {RuleTester} from '@typescript-eslint/rule-tester';

import {preferInfoText} from './preferInfoText';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

function errorWithSuggestion(output: string) {
  return {
    messageId: 'preferInfoText',
    suggestions: [
      {
        messageId: 'replaceWithInfoText',
        output,
      },
    ],
  } as const;
}

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
    {
      name: 't() call from another binding',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const t = (value: string) => value;
        const x = <Tooltip title="x">{t('label')}</Tooltip>;
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
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="explanation">Some text here</InfoText>;
      `),
      ],
    },
    {
      name: 't() i18n call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title={description}>{t('Click to expand')}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title={description}>{t('Click to expand')}</InfoText>;
      `),
      ],
    },
    {
      name: 'tct() i18n call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {tct} from 'sentry/locale';
        const x = <Tooltip title={desc}>{tct('Hello [name]', {name})}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {tct} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title={desc}>{tct('Hello [name]', {name})}</InfoText>;
      `),
      ],
    },
    {
      name: 'String literal in expression container',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{'some string'}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">{'some string'}</InfoText>;
      `),
      ],
    },
    {
      name: 'Template literal',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x">{\`hello \${name}\`}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">{\`hello \${name}\`}</InfoText>;
      `),
      ],
    },
    {
      name: 'span wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><span>label text</span></Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x"><span>label text</span></InfoText>;
      `),
      ],
    },
    {
      name: 'span wrapping t() call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title="x"><span>{t('label')}</span></Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x"><span>{t('label')}</span></InfoText>;
      `),
      ],
    },
    {
      name: 'inline semantic text wrapper',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><strong>label text</strong></Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x"><strong>label text</strong></InfoText>;
      `),
      ],
    },
    {
      name: 'paragraph wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x"><p>label text</p></Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x"><p>label text</p></InfoText>;
      `),
      ],
    },
    {
      name: 'Text component wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {Text} from '@sentry/scraps/text';
        const x = <Tooltip title="x" isHoverable showUnderline><Text variant="muted" size="sm">label</Text></Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {Text} from '@sentry/scraps/text';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText title="x" variant="muted" size="sm">label</InfoText>;
      `),
      ],
    },
    {
      name: 'Text component with property access',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {Text} from '@sentry/scraps/text';
        const x = (
          <Tooltip
            title={dashboard.title}
            position="top"
            showOnlyOnOverflow
            skipWrapper
          >
            <Text ellipsis variant="inherit">
              {dashboard.title}
            </Text>
          </Tooltip>
        );
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {Text} from '@sentry/scraps/text';
import {InfoText} from '@sentry/scraps/info';

        const x = (
          <InfoText title={dashboard.title} position="top" mode="overflowOnly" variant="inherit">
              {dashboard.title}
            </InfoText>
        );
      `),
      ],
    },

    {
      name: 'showUnderline is stripped in suggestion',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x" showUnderline>Some text here</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">Some text here</InfoText>;
      `),
      ],
    },
    {
      name: 'isHoverable is stripped in suggestion',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x" isHoverable>Some text here</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">Some text here</InfoText>;
      `),
      ],
    },
    {
      name: 'isHoverable false has no suggestion',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x" isHoverable={false}>Some text here</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'showOnlyOnOverflow becomes overflowOnly mode in suggestion',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x" showOnlyOnOverflow>Some text here</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x" mode="overflowOnly">Some text here</InfoText>;
      `),
      ],
    },
    {
      name: 'Tooltip with unsupported disabled prop',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title="x" showUnderline disabled>{t('label')}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Text component with delay and disabled',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {Text} from '@sentry/scraps/text';
        const x = (
          <Tooltip
            title={meta.volumeTooltip}
            delay={100}
            disabled={isDisabled}
          >
            <Text
              variant="muted"
              underline="dotted"
              size="sm"
              density="comfortable"
            >
              {meta.volume}
            </Text>
          </Tooltip>
        );
      `,
      errors: [{messageId: 'preferInfoText'}],
    },
    {
      name: 'Tooltip with supported delay prop',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="x" delay={100}>Some text here</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x" delay={100}>Some text here</InfoText>;
      `),
      ],
    },
    {
      name: 'Multiple text-like children',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title="x">Hello {t('world')}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">Hello {t('world')}</InfoText>;
      `),
      ],
    },
    {
      name: 'Aliased Tooltip import',
      code: `
        import {Tooltip as Tip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tip title="x">{t('label')}</Tip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip as Tip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">{t('label')}</InfoText>;
      `),
      ],
    },
    {
      name: 'Fragment wrapping text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title="x"><>{t('label')}</></Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x"><>{t('label')}</></InfoText>;
      `),
      ],
    },
    {
      name: 'Conditional expression with text branches',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title="x">{condition ? t('a') : t('b')}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">{condition ? t('a') : t('b')}</InfoText>;
      `),
      ],
    },
    {
      name: 'Logical AND with text',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const x = <Tooltip title="x">{condition && t('label')}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="x">{condition && t('label')}</InfoText>;
      `),
      ],
    },
    {
      name: 'Uses existing InfoText import in suggestion',
      code: `
        import {InfoText as TextWithInfo} from '@sentry/scraps/info';
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <Tooltip title="explanation">Some text here</Tooltip>;
      `,
      errors: [
        {
          messageId: 'preferInfoText',
          suggestions: [
            {
              messageId: 'replaceWithInfoText',
              output: `
        import {InfoText as TextWithInfo} from '@sentry/scraps/info';
        import {Tooltip} from '@sentry/scraps/tooltip';
        const x = <TextWithInfo variant="inherit" title="explanation">Some text here</TextWithInfo>;
      `,
            },
          ],
        },
      ],
    },
  ],
});
