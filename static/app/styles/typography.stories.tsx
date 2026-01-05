import type {CSSProperties} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import LetterSpacingGraphic from 'sentry-images/stories/typography/letter-spacing.svg';
import LineHeightGraphic from 'sentry-images/stories/typography/line-height.svg';
import WeightGraphic from 'sentry-images/stories/typography/weight.svg';

import {CodeBlock} from 'sentry/components/core/code';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconCheckmark, IconCircleFill, IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';

const FixedWidth = styled('div')`
  max-width: 800px;
`;

interface TypeScaleItem {
  fontSize: CSSProperties['fontSize'];
  fontWeight: CSSProperties['fontWeight'];
  letterSpacing: CSSProperties['letterSpacing'];
  lineHeight: CSSProperties['lineHeight'];
  name: string;
}
const TYPE_SCALE: TypeScaleItem[] = [
  {
    name: 'Heading 1',
    fontWeight: 600,
    fontSize: '2.25rem',
    lineHeight: 1.2,
    letterSpacing: '-0.02rem',
  },
  {
    name: 'Heading 2',
    fontWeight: 600,
    fontSize: '1.875rem',
    lineHeight: 1.2,
    letterSpacing: '-0.016em',
  },
  {
    name: 'Heading 3',
    fontWeight: 600,
    fontSize: '1.625rem',
    lineHeight: 1.2,
    letterSpacing: '-0.012em',
  },
  {
    name: 'Heading 4',
    fontWeight: 600,
    fontSize: '1.375rem',
    lineHeight: 1.2,
    letterSpacing: '-0.008em',
  },
  {
    name: 'Heading 5',
    fontWeight: 600,
    fontSize: '1.25rem',
    lineHeight: 1.2,
    letterSpacing: '-0.004em',
  },
  {
    name: 'Heading 6',
    fontWeight: 600,
    fontSize: '1.125rem',
    lineHeight: 1.2,
    letterSpacing: 'normal',
  },
  {
    name: 'Paragraph',
    fontWeight: 400,
    fontSize: '1rem',
    lineHeight: 1.4,
    letterSpacing: 'normal',
  },
  {
    name: 'Button/Label',
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: 1.2,
    letterSpacing: 'normal',
  },
  {
    name: 'Small',
    fontWeight: 400,
    fontSize: '0.875rem',
    lineHeight: 1.4,
    letterSpacing: '+0.01rem',
  },
];

const InlineLinkExampleStyles = `styled('a')\`
  color: \${p => p.theme.blue300};
  text-decoration: underline;
  text-decoration-color: ${(p: any) => p.theme.colors.blue100};
  cursor: pointer;

  &:hover {
    text-decoration-color: ${(p: any) => p.theme.colors.blue200};
  }
\`;
`;

const StandaloneLinkExampleStyles = `/* Link color is flexible, choose between Gray 500, 400, and 300. */
styled('a')\`
  color: \${p => p.theme.gray500};
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    text-decoration-color: \${p => p.theme.gray200};
  }
\`;
`;

const UnorderedListExampleStyles = `/* First-level items */
ul > li {
  list-style-type: disc;
}

/* Second-level items */
ul > ul > li {
  list-style-type: circle;
}
`;

const OrderedListExampleStyles = `/* First-level items */
ul > li {
  list-style-type: decimal;
}

/* Second-level items */
ul > ul > li {
  list-style-type: lower-alpha;
}
`;

const TabularNumsExampleStyles = `/* Add this to numeric columns */
font-variant-numeric: tabular-nums;
`;

const FontLigatureExampleStyles = `/* Add this to the root element */
font-feature-settings: 'liga';
`;

const FontFractionExampleStyles = `/* Be careful: this changes the appearance of normal,
non-fractional numbers, so only apply it to specific
text elements with fractions inside. */
font-feature-settings: 'frac';
`;

export default function TypographyStories() {
  return (
    <FixedWidth>
      <h3>Typography</h3>
      <Block>
        We've built Sentry's type system around Rubik - a playful open-source typeface.
        For code and code-like elements, we use <code>Roboto Mono</code>.
      </Block>
      <hr />
      <h4>Type scale</h4>
      <Block>
        Type scales are hierarchical type systems consisting of style definitions for
        common elements, such as Heading 1, Heading 2, Paragraph, and Button/Label.
      </Block>
      <Block>
        Sentry's type scale is based on the Rubik typeface. The root font size is 16px
        (1rem = 16px).
      </Block>
      <PanelTable headers={['Scale', 'Weight', 'Size', 'Line Height', 'Letter Spacing']}>
        {TYPE_SCALE.map(({name, ...props}) => {
          return (
            <Fragment key={name}>
              <div style={props}>{name}</div>
              <div>{props.fontWeight}</div>
              <div>{props.fontSize}</div>
              <div>{props.lineHeight}</div>
              <div>{props.letterSpacing}</div>
            </Fragment>
          );
        })}
      </PanelTable>
      <hr />
      <h4>Styling</h4>
      <Block>
        The type scale above should cover a large majority of use cases. However, if an
        element requires a custom style outside of the type scale, make sure to follow the
        rules below.
      </Block>
      <h5>Size</h5>
      <Block>
        <strong>Use values from the type scale above.</strong> Be mindful of the type
        hierarchy. If the element has low importance, use a smaller size.
      </Block>
      <Block>
        <Flex gap="md" align="start">
          <PositiveLabel />
          Always define font sizes with the <code>rem</code> unit.
        </Flex>
      </Block>
      <h5>Weight</h5>
      <Block>
        <ExampleImg src={WeightGraphic} />
      </Block>
      <ul>
        <li>
          <strong>Use Medium (600)</strong> for headings, button labels, and elements that
          need to stand out from the rest of the user interface, like table headers
        </li>
        <li>
          <strong>Use Regular (400)</strong> for all other elements
        </li>
      </ul>
      <h5>Line height</h5>
      <Block>
        <ExampleImg src={LineHeightGraphic} />
      </Block>
      <ul>
        <li>
          <strong>Use 1.4</strong> for body text (content that can wrap to multiple lines)
        </li>
        <li>
          <strong>Use 1.2</strong> for headings and short, single-line text like table
          headers and input fields
        </li>
        <li>
          <strong>Use 1</strong> for text labels with immediate bounding boxes, like
          buttons, pills, and badges
        </li>
      </ul>
      <h5>Letter spacing</h5>
      <Block>
        <ExampleImg src={LetterSpacingGraphic} />
      </Block>
      <ul>
        <li>
          <strong>Reduce letter spacing for headings.</strong> This makes them look more
          condensed, thereby reinforcing their high order in the type hierarchy. Refer to
          the type scale above for how much to reduce.
        </li>
        <li>
          <strong>
            Increase letter spacing (+0.02rem) in text elements that are smaller than
            16px,
          </strong>
          with the exception of code and code-like elements. This makes them easier to
          read.
        </li>
      </ul>
      <hr />
      <h4>Code</h4>
      <Block>
        Use Roboto Mono in Regular (400) for code and code-like elements, like search
        tokens.
      </Block>
      <Block>Set the line height based on the context:</Block>
      <ul>
        <li>
          <strong>For multi-line code</strong>, use 1.6
        </li>
        <li>
          <strong>For single-line code elements</strong>, like search tokens, use the same
          line height as that of the text surrounding the token
        </li>
      </ul>
      <hr />
      <h4>External Links</h4>
      <Block>
        External links lead users to pages outside the application. Examples include links
        to Sentry's blog/marketing pages, terms of service, third-party documentation,…
      </Block>
      <Block>
        The following styling rules apply to external links only. Internal links, on the
        other hand, can have more flexible styles, based on their behavior and context.
      </Block>
      <h5>In a sentence</h5>
      <Block>When a link appears inside a longer sentence…</Block>
      <ExamplePanel>
        ... like this{' '}
        <FixedExternalLink onClick={() => {}}>little link</FixedExternalLink>.
      </ExamplePanel>
      <ul>
        <li>
          Use <ColorSwatch color="blue300" /> as the text color
        </li>
        <li>
          Add a solid underline in <ColorSwatch color="blue100" />
        </li>
        <li>
          Don't include any preceding articles (a, the, this, our) in the linked text, for
          example:
          <ul>
            <li>
              <Flex gap="md" align="baseline">
                <PositiveLabel style={{alignSelf: 'end'}} /> the{' '}
                <FixedExternalLink onClick={() => {}}>
                  Church of the Flying Spaghetti Monster
                </FixedExternalLink>
              </Flex>
            </li>
            <li>
              <Flex gap="md" align="baseline">
                <NegativeLabel style={{alignSelf: 'end'}} />{' '}
                <FixedExternalLink onClick={() => {}}>
                  the Church of the Flying Spaghetti Monster
                </FixedExternalLink>
              </Flex>
            </li>
          </ul>
        </li>
        <li>
          On hover:
          <ul>
            <li>
              Use a pointer cursor - <code>cursor: pointer</code>
            </li>
            <li>
              Change the underline color to <ColorSwatch color="blue200" />
            </li>
          </ul>
        </li>
      </ul>
      <Block>
        <CodeBlock filename="Styled Components" language="typescript">
          {InlineLinkExampleStyles}
        </CodeBlock>
      </Block>
      <h5>Standalone</h5>
      <Block>
        When a link appears on its own and the user likely knows that it's a link given
        the context, like in a footer:
      </Block>
      <ExamplePanel>
        <Flex direction="column">
          <FooterLink to="">Privacy Policy</FooterLink>
          <FooterLink to="">Terms of Use</FooterLink>
        </Flex>
      </ExamplePanel>
      <ul>
        <li>
          Use <ColorSwatch color="gray500" />, <ColorSwatch color="gray400" />, or{' '}
          <ColorSwatch color="gray300" />, depending on the context
        </li>
        <li>Don't add any underline</li>
        <li>
          On hover:
          <ul>
            <li>
              Use a pointer cursor - <code>cursor: pointer</code>
            </li>
            <li>
              Add a solid underline in <ColorSwatch color="gray200" />
            </li>
          </ul>
        </li>
      </ul>
      <Block>
        <CodeBlock filename="Styled Components" language="typescript">
          {StandaloneLinkExampleStyles}
        </CodeBlock>
      </Block>
      <hr />
      <h4>Lists</h4>
      <h5>Unordered</h5>
      <Block>Use filled and hollow circles as bullets points:</Block>
      <ExamplePanel>
        <ul>
          <li>
            Camelus
            <ul>
              <li>Bactrian camel</li>
              <li>Dromedary</li>
            </ul>
          </li>
          <li>
            Lama
            <ul>
              <li>Llama</li>
              <li>Alpaca</li>
            </ul>
          </li>
        </ul>
      </ExamplePanel>
      <Block>
        <CodeBlock filename="CSS" language="css">
          {UnorderedListExampleStyles}
        </CodeBlock>
      </Block>
      <Block>
        <Flex gap="md" align="start">
          <PositiveLabel />
          Don't add full stops (.) to the end of each item, unless the item contains
          multiple sentences.
        </Flex>
      </Block>
      <Block>
        <Flex gap="md" align="start">
          <PositiveLabel /> Avoid using custom symbols and icons as bullet characters, as
          they usually look out of place and distract from the main text content.
        </Flex>
      </Block>
      <h5>Ordered</h5>
      <Block>Use Arabic numerals and lowercase letters as counters:</Block>
      <ExamplePanel>
        <ol>
          <li>
            Camelus
            <ol>
              <li>Bactrian camel</li>
              <li>Dromedary</li>
            </ol>
          </li>
          <li>
            Lama
            <ol>
              <li>Llama</li>
              <li>Alpaca</li>
            </ol>
          </li>
        </ol>
      </ExamplePanel>
      <Block>
        <CodeBlock filename="CSS" language="css">
          {OrderedListExampleStyles}
        </CodeBlock>
      </Block>
      <Block>
        <Flex gap="md" align="start">
          <PositiveLabel />
          Avoid using custom symbols and icons as counters.
        </Flex>
      </Block>
      <hr />
      <h4>OpenType features</h4>
      <Block>
        Rubik supports a few useful{' '}
        <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Fonts/OpenType_fonts_guide">
          OpenType font features
        </ExternalLink>
        . These features, or variants, are alternative characters that, when used in the
        right places, can help improve the reading experience.
      </Block>
      <h5>Tabular figures</h5>
      <Block>
        By default, Rubik uses proportional figures. This works well in most cases.
        However, for large tables with a lot of numbers, tabular figures would be a better
        choice, thanks to their consistent width and more legible design.
      </Block>
      <PanelTable headers={['Proportional Figures', 'Tabular Figures']}>
        <div>999,999</div>
        <TabularNum>999,999</TabularNum>
        <div>111,111</div>
        <TabularNum>111,111</TabularNum>
        <div>9.99999</div>
        <TabularNum>9.99999</TabularNum>
        <div>1.11111</div>
        <TabularNum>1.11111</TabularNum>
      </PanelTable>
      <Block>
        <CodeBlock filename="CSS" language="css">
          {TabularNumsExampleStyles}
        </CodeBlock>
      </Block>
      <h5>Ligatures</h5>
      <Block>
        Ligatures are special glyphs that replace two or more glyphs in order to better
        connect them. Common ligature replacements include ff, fi, fl, and ffi.
      </Block>
      <SideBySideList>
        <li>
          <ExamplePanel fontSize="large">
            <FontNoLiga>ff, fi, fl</FontNoLiga>
          </ExamplePanel>
          <Block>Without ligatures, the characters are all separate.</Block>
        </li>
        <li>
          <ExamplePanel fontSize="large">
            <FontLiga>ff, fi, fl</FontLiga>
          </ExamplePanel>
          <Block>With ligatures, the characters are connected into a single glyph.</Block>
        </li>
      </SideBySideList>
      <Block>
        <Flex gap="md" align="start">
          <PositiveLabel />
          Use ligatures across the whole user interface.
        </Flex>
      </Block>
      <Block>
        <CodeBlock filename="CSS" language="css">
          {FontLigatureExampleStyles}
        </CodeBlock>
      </Block>
      <h5>Fractions</h5>
      <SideBySideList>
        <li>
          <ExamplePanel fontSize="large">1/12</ExamplePanel>
          <Block>
            Rubik also contains special formatting for fractions. Without this formatting,
            numbers in fractions are just rendered as separate characters.
          </Block>
        </li>
        <li>
          <ExamplePanel fontSize="large">
            <FontFractional>1/12</FontFractional>
          </ExamplePanel>
          <Block>
            Fractional formatting shrinks the numbers and connects them with a diagonal
            slash, forming a proportional, condensed visual block.
          </Block>
        </li>
      </SideBySideList>

      <Block>
        <Flex gap="md" align="start">
          <PositiveLabel />
          Use fractional formatting whenever possible.
        </Flex>
      </Block>
      <Block>
        <CodeBlock filename="CSS" language="css">
          {FontFractionExampleStyles}
        </CodeBlock>
      </Block>
    </FixedWidth>
  );
}

const Block = styled('div')`
  margin-bottom: ${space(3)};
`;

const FixedExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.colors.blue400};
  text-decoration: underline ${p => p.theme.colors.blue100};

  :hover {
    color: ${p => p.theme.colors.blue400};
    text-decoration: underline ${p => p.theme.colors.blue200};
  }
`;

const FooterLink = styled(Link)`
  color: ${p => p.theme.subText};

  :hover {
    color: ${p => p.theme.subText};
    text-decoration: underline ${p => p.theme.colors.gray200};
  }
`;

const SideBySideList = styled('ul')`
  /* Reset */
  list-style-type: none;
  margin: 0;
  padding: 0;
  & > li {
    margin: 0;
  }
  & > li > div {
    margin-bottom: 0;
  }

  /* Side-by-side display */
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;

const ColorSwatch = styled(
  ({
    color,
    className,
    style,
  }: {
    color: ColorOrAlias;
    className?: string;
    style?: CSSProperties;
  }) => (
    <span className={className} style={style}>
      <IconCircleFill color={color} />
      {color}
    </span>
  )
)`
  display: inline-flex;
  gap: ${space(0.5)};
  align-items: center;

  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(0.25)} ${space(0.5)};
  vertical-align: sub;
`;

const ExampleImg = styled('img')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
`;

const PositiveLabel = styled(
  ({className, style}: {className?: string; style?: CSSProperties}) => (
    <div className={className} style={style}>
      <IconCheckmark />
      DO
    </div>
  )
)`
  color: ${p => p.theme.colors.green500};
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeight.bold};
  gap: ${space(0.5)};
`;

const NegativeLabel = styled(
  ({className, style}: {className?: string; style?: CSSProperties}) => (
    <div className={className} style={style}>
      <IconClose color="red400" />
      DON'T
    </div>
  )
)`
  color: ${p => p.theme.colors.red500};
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeight.bold};
  gap: ${space(0.5)};
`;

const ExamplePanel = styled(Panel)<{fontSize?: 'large'}>`
  padding: ${space(2)};
  ${p =>
    p.fontSize === 'large'
      ? css`
          font-weight: ${p.theme.fontWeight.bold};
          font-size: 1.875rem;
          line-height: 1.2;
          letter-spacing: -0.016em;
        `
      : ''}
`;

const TabularNum = styled('div')`
  font-variant-numeric: tabular-nums;
`;

const FontLiga = styled('div')`
  /**
   * TODO: This should be applied to the root node of the side, why is that not the case?
   */
  font-feature-settings: 'liga';
`;
const FontNoLiga = styled('div')`
  /**
   * Using 'liga' is the default
   * We want to turn it off for the example.
   *
   * Don't copy+paste this!
   */
  font-feature-settings: 'liga' 0;
`;

const FontFractional = styled('div')`
  font-feature-settings: 'frac';
`;
