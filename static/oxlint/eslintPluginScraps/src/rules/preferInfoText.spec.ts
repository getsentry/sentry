import {RuleTester} from 'oxlint/plugins-dev';

import {preferInfoText} from './preferInfoText';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
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
  };
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
      name: 'Mutable variable initialized with Text',
      code: `
        import {Text} from '@sentry/scraps/text';
        import {Tooltip} from '@sentry/scraps/tooltip';
        let text = <Text>label</Text>;
        text = <IconInfo />;
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
    },
    {
      name: 'Constant initialized with a non-text component',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = <IconInfo />;
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
    },
    {
      name: 'Parameter shadows a text constant',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = 'label';
        function Example(text) {
          return <Tooltip title="help">{text}</Tooltip>;
        }
      `,
    },
    {
      name: 'Block declaration shadows a text constant before its declaration',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = 'label';
        function Example() {
          const x = <Tooltip title="help">{text}</Tooltip>;
          const text = <IconInfo />;
          return x;
        }
      `,
    },
    {
      name: 'Text constant from a sibling scope is not resolved',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        function First() {
          const text = 'label';
          return text;
        }
        function Second() {
          return <Tooltip title="help">{text}</Tooltip>;
        }
      `,
    },
    {
      name: 'Destructured constant is not treated as its initializer',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const {text} = 'label';
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
    },
    {
      name: 'Cyclic constant references',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const first = second;
        const second = first;
        const x = <Tooltip title="help">{first}</Tooltip>;
      `,
    },
    {
      name: 'Cyclic constant reference through JSX',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = <span>{text}</span>;
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
    },
    {
      name: 'Conditional constant with a non-text branch',
      code: `
        import {Text} from '@sentry/scraps/text';
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = condition ? <Text>label</Text> : <IconInfo />;
        const x = <Tooltip title="help">{text}</Tooltip>;
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
      name: 'Tooltip wrapping a Text element stored in a local constant',
      code: `
        import {Text} from '@sentry/scraps/text';
        import {Tooltip} from '@sentry/scraps/tooltip';
        function Example({value, ellipsis}) {
          return <Container>{props => {
            const text = (
              <Text {...props} monospace variant="accent" ellipsis={ellipsis || undefined}>
                {value}
              </Text>
            );
            return ellipsis ? (
              <Tooltip title={value} showOnlyOnOverflow skipWrapper>
                {text}
              </Tooltip>
            ) : text;
          }}</Container>;
        }
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'String constant',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = 'label';
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'Constant initialized with a locale call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {t} from 'sentry/locale';
        const text = t('label');
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'Chain of constants initialized with aliased Text',
      code: `
        import {Text as Label} from '@sentry/scraps/text';
        import {Tooltip} from '@sentry/scraps/tooltip';
        const original = <Label>{value}</Label>;
        const text = original;
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'Initializer references are resolved in their own scope',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const label = 'label';
        const text = <span>{label}</span>;
        function Example(label) {
          return <Tooltip title="help">{text}</Tooltip>;
        }
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'Conditional constant with text branches',
      code: `
        import {Text} from '@sentry/scraps/text';
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = condition ? <Text>{value}</Text> : <span>label</span>;
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'Fragment constant',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = <>label</>;
        const x = <Tooltip title="help">{text}</Tooltip>;
      `,
      errors: [{messageId: 'preferInfoText', suggestions: []}],
    },
    {
      name: 'Repeated references to the same text constant',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        const text = 'label';
        const x = <Tooltip title="help">{text} {text}</Tooltip>;
        const y = <Tooltip title="help">{text}</Tooltip>;
      `,
      errors: [
        {messageId: 'preferInfoText', suggestions: []},
        {messageId: 'preferInfoText', suggestions: []},
      ],
    },
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
      name: 'tn() i18n call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {tn} from 'sentry/locale';
        const x = <Tooltip title={desc}>{tn('%s project', '%s projects', count)}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {tn} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title={desc}>{tn('%s project', '%s projects', count)}</InfoText>;
      `),
      ],
    },
    {
      name: 'Any locale helper call',
      code: `
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {td} from 'sentry/locale';
        const x = <Tooltip title="help">{td('Some description')}</Tooltip>;
      `,
      errors: [
        errorWithSuggestion(`
        import {Tooltip} from '@sentry/scraps/tooltip';
        import {td} from 'sentry/locale';
import {InfoText} from '@sentry/scraps/info';

        const x = <InfoText variant="inherit" title="help">{td('Some description')}</InfoText>;
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
