import styled from '@emotion/styled';

import DoAccentColors from 'sentry-images/stories/color/do-accent-colors.svg';
import DoContrast from 'sentry-images/stories/color/do-contrast.svg';
import DoDifferentiation from 'sentry-images/stories/color/do-differentiation.svg';
import DontAccentColors from 'sentry-images/stories/color/dont-accent-colors.svg';
import DontContrast from 'sentry-images/stories/color/dont-contrast.svg';
import DontDifferentiation from 'sentry-images/stories/color/dont-differentiation.svg';

import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import ThemeToggle from 'sentry/components/stories/themeToggle';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';
import theme from 'sentry/utils/theme';

interface Palette {
  color: ColorOrAlias;
  text: ColorOrAlias;
}

const GRAY_PALETTES: Palette[][] = [
  [{color: 'gray500', text: 'lightModeWhite'}],
  [{color: 'gray400', text: 'lightModeWhite'}],
  [{color: 'gray300', text: 'lightModeWhite'}],
  [{color: 'gray200', text: 'lightModeBlack'}],
  [{color: 'gray100', text: 'lightModeBlack'}],
];

const LEVELS_PALETTES: Palette[][] = [
  [
    {color: 'purple400', text: 'lightModeWhite'},
    {color: 'purple300', text: 'lightModeWhite'},
    {color: 'purple200', text: 'lightModeBlack'},
    {color: 'purple100', text: 'lightModeBlack'},
  ],
  [
    {color: 'blue400', text: 'lightModeWhite'},
    {color: 'blue300', text: 'lightModeWhite'},
    {color: 'blue200', text: 'lightModeBlack'},
    {color: 'blue100', text: 'lightModeBlack'},
  ],
  [
    {color: 'green400', text: 'lightModeWhite'},
    {color: 'green300', text: 'lightModeBlack'},
    {color: 'green200', text: 'lightModeBlack'},
    {color: 'green100', text: 'lightModeBlack'},
  ],
  [
    {color: 'yellow400', text: 'lightModeBlack'},
    {color: 'yellow300', text: 'lightModeBlack'},
    {color: 'yellow200', text: 'lightModeBlack'},
    {color: 'yellow100', text: 'lightModeBlack'},
  ],
  [
    {color: 'red400', text: 'lightModeWhite'},
    {color: 'red300', text: 'lightModeWhite'},
    {color: 'red200', text: 'lightModeBlack'},
    {color: 'red100', text: 'lightModeBlack'},
  ],
  [
    {color: 'pink400', text: 'lightModeWhite'},
    {color: 'pink300', text: 'lightModeWhite'},
    {color: 'pink200', text: 'lightModeBlack'},
    {color: 'pink100', text: 'lightModeBlack'},
  ],
];

const FixedWidth = styled('div')`
  max-width: 800px;
`;

export default function ColorStories() {
  return (
    <FixedWidth>
      <h3>Colors</h3>
      <p>
        Sentry has a flexible, tiered color system that adapts to both light and dark
        mode. Our color palette consists of neutral grays and 6 accent colors.
      </p>
      <hr />
      <h4>Grays</h4>
      <p>
        There are 5 shades of gray, ranging from Gray 500 (darkest) to Gray 100
        (lightest).
      </p>
      <p>
        <strong>Gray 300 and above</strong> are accessible foreground colors that conform
        to{' '}
        <ExternalLink href="https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html">
          WCAG standards
        </ExternalLink>
        . Use them as text and icon colors.
      </p>
      <p>Here are the recommended use cases:</p>
      <ul>
        <li>
          <strong>Gray 500:</strong> headings, button labels, tags/badges, and alerts.
        </li>
        <li>
          <strong>Gray 400:</strong> body text, input values & labels.
        </li>
        <li>
          <strong>Gray 300:</strong> input placeholders, inactive/disabled inputs and
          buttons, chart labels, supplemental and non-essential text
        </li>
        <li>
          <strong>Gray 200:</strong> borders around large elements (cards, panels,
          dialogs, tables).
        </li>
        <li>
          <strong>Gray 100:</strong> dividers and borders around small elements (buttons,
          form inputs).
        </li>
      </ul>
      <ThemeToggle>
        <ColorPalette name="grays" palette={GRAY_PALETTES} />
      </ThemeToggle>
      <hr />
      <h4>Accent Colors</h4>
      <p>
        Accent colors help shift the user&apos;s focus to certain interactive and
        high-priority elements, like links, buttons, and warning banners.
      </p>
      <h5>Hues</h5>
      <p>There are 6 hues to choose from. Each has specific connotations:</p>
      <ul>
        <li>
          <strong>Purple:</strong> brand, current/active/focus state, or new information.
        </li>
        <li>
          <strong>Blue:</strong> hyperlink.
        </li>
        <li>
          <strong>Green:</strong> success, resolution, approval, availability, or
          creation.
        </li>
        <li>
          <strong>Yellow:</strong> warning, missing, or impeded progress.
        </li>
        <li>
          <strong>Red:</strong> fatal error, deletion, or removal.
        </li>
        <li>
          <strong>Pink:</strong> new feature or promotion.
        </li>
      </ul>
      <h5>Levels</h5>
      <p>
        Each hue comes in 4 levels: 400 (dark), 300 (full opacity), 200 (medium opacity),
        and 100 (low opacity).
      </p>
      <ul>
        <li>
          <strong>The 400 level</strong> is a darkened version of 300. It is useful for
          hover/active states in already accentuated elements. For example, a button could
          have a background of Purple 300 in normal state and Purple 400 on hover.
        </li>
        <li>
          <strong>The 300 level</strong> has full opacity and serves well as text and icon
          colors (with the exception of Yellow 300, which does not meet{' '}
          <ExternalLink href="https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html">
            WCAG&apos;s contrast standards
          </ExternalLink>
          ).
        </li>
        <li>
          <strong>The 200 level</strong> has medium opacity, useful for borders and
          dividers.
        </li>
        <li>
          <strong>The 100 level</strong> has very low opacity, useful as background fills.
        </li>
      </ul>
      <ThemeToggle>
        <ColorPalette name="levels" palette={LEVELS_PALETTES} />
      </ThemeToggle>
      <hr />
      <h4>Accessibility</h4>
      <p>
        When it comes to using color, there are two main accessibility concerns:
        readability and separation.
      </p>
      <h5>Readability</h5>
      <p>
        <ExternalLink href="https://www.w3.org/TR/WCAG21/">WCAG</ExternalLink> requires
        that normal text elements have a contrast ratio of at least 4.5:1 against the
        background. For large text (at least 16px in size AND in medium/bold weight), the
        required ratio is lower, at 3:1. This is to ensure a comfortable reading
        experience in different lighting conditions.{' '}
        <ExternalLink href="https://webaim.org/resources/contrastchecker/">
          Use this tool
        </ExternalLink>{' '}
        to confirm text contrast ratios.
      </p>
      <p>
        In Sentry&apos;s color palette, only Gray 300 and above satisfy the contrast
        requirement for normal text. This applies to both light and dark mode.
      </p>
      <p>
        Accent colors in the 300 series, except for Yellow 300, satisfy the contrast
        requirement for large text.
      </p>

      <SideBySideList>
        <ExampleCard
          imgSrc={DoContrast}
          text="Use Gray 300 and above for normal text"
          isPositive
        />
        <ExampleCard
          imgSrc={DontContrast}
          text="Use Gray 100 or 200 for normal text, as they don't have the required the contrast levels"
        />
        <ExampleCard
          imgSrc={DoAccentColors}
          text="Use accent colors in the 300 series (except for Yellow 300) for large text, if needed"
          isPositive
        />
        <ExampleCard
          imgSrc={DontAccentColors}
          text="Use accent colors in the 100 or 200 series for any text"
        />
      </SideBySideList>

      <h5>Separation</h5>
      <p>
        Color can be an effective way to visually separate elements in the user interface.
        However, not all users see color in the same way. Some are color-blind and cannot
        reliably differentiate one color from another. Some have color filters on their
        screens, like Night Shift in MacOS. Others are in bright environments with high
        levels of glare, reducing their ability to see color clearly.
      </p>
      <p>
        As such, color is an unreliable way to separate elements. Whenever possible,
        provide additional visual cues like icons, text labels, line type (solid, dashed,
        dotted),… to further reinforce the separation.
      </p>
      <SideBySideList>
        <ExampleCard
          imgSrc={DoDifferentiation}
          text="Provide additional visual encoding (e.g. line type) besides color to differentiate elements"
          isPositive
        />
        <ExampleCard
          imgSrc={DontDifferentiation}
          text="Use color as the only way to differentiate elements"
        />
      </SideBySideList>
    </FixedWidth>
  );
}

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

const PalettePanel = styled(Panel)`
  margin-bottom: 0;
`;

const PalettePanelItem = styled(PanelItem)<{
  color: ColorOrAlias;
  text: ColorOrAlias;
}>`
  flex-direction: column;
  gap: ${space(0.5)};

  &:first-child {
    border-radius: ${p => p.theme.borderRadiusTop};
  }
  &:last-child {
    border-radius: ${p => p.theme.borderRadiusBottom};
  }
  &:first-child:last-child {
    border-radius: ${p => p.theme.borderRadius};
  }

  background: ${p => p.theme[p.color]};
  color: ${p => p.theme[p.text]};
`;

function ColorPalette({name, palette}: {name: string; palette: Palette[][]}) {
  return (
    <SideBySideList>
      {palette.map((section, i) => {
        return (
          <li key={`${name}-${i}`}>
            <PalettePanel typeof="ul">
              {section.map(color => {
                return (
                  <PalettePanelItem
                    key={`${name}-${color.color}`}
                    color={color.color}
                    text={color.text}
                  >
                    <strong>{color.color}</strong>
                    {theme[color.color]}
                  </PalettePanelItem>
                );
              })}
            </PalettePanel>
          </li>
        );
      })}
    </SideBySideList>
  );
}

const ExampleImg = styled('img')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 400px;
`;

const PositiveLabel = styled(({className}: {className?: string}) => (
  <div className={className}>
    <IconCheckmark />
    DO
  </div>
))`
  color: ${p => p.theme.green400};
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeightBold};
  gap: ${space(0.5)};
`;

const NegativeLabel = styled(({className}: {className?: string}) => (
  <div className={className}>
    <IconClose color="red400" />
    DON&apos;T
  </div>
))`
  color: ${p => p.theme.red400};
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeightBold};
  gap: ${space(0.5)};
`;

const ExampleCardGrid = styled('figcaption')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  align-items: flex-start;
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(1)} 0;
`;

interface ExampleCardProps {
  imgSrc: string;
  text: string;
  isPositive?: boolean;
}
function ExampleCard({imgSrc, text, isPositive}: ExampleCardProps) {
  return (
    <figure>
      <ExampleImg src={imgSrc} />
      <ExampleCardGrid>
        {isPositive ? <PositiveLabel /> : <NegativeLabel />}
        <span>{text}</span>
      </ExampleCardGrid>
    </figure>
  );
}
