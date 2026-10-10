import {createElement} from 'react';
import {css as emotionCss, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {css} from '@linaria/core';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Button, LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code/inlineCode';
import {DropdownButton} from '@sentry/scraps/dropdownMenu/dropdownButton';
import {Kbd} from '@sentry/scraps/hotkey/kbd';
import {Container, Flex, Grid, Stack, Surface} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {Quote} from '@sentry/scraps/quote';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';
import {theme} from '@sentry/scraps/theme';

const customStyles = css`
  color: ${theme.tokens.content.primary};
  margin-left: ${theme.space.md};
`;

const StyledFlex = styled(Flex)`
  color: ${p => p.theme.tokens.content.accent};
`;

describe('Linaria core styling', () => {
  it('accepts Linaria class names through Emotion styled wrappers', () => {
    render(
      <StyledFlex customCss={customStyles} className="existing">
        Styled content
      </StyledFlex>
    );

    expect(screen.getByText('Styled content')).toHaveClass(customStyles, 'existing');
    expect(screen.getByText('Styled content')).not.toHaveAttribute('customCss');
    expect(extractedCustomRule()?.style.getPropertyValue('margin-left')).toBe('8px');
  });

  it('passes custom classes through the render-prop form', () => {
    render(
      <Container customCss={customStyles} className="existing" padding="md">
        {props => <section {...props}>Render-prop content</section>}
      </Container>
    );

    expect(screen.getByText('Render-prop content')).toHaveClass(customStyles);
    expect(extractedCustomRule()?.style.getPropertyValue('margin-left')).toBe('8px');
  });

  it('merges customCss and className with React.createElement', () => {
    render(
      createElement(
        Flex,
        {
          customCss: customStyles,
          className: 'existing',
        },
        'Direct content'
      )
    );
    expect(screen.getByText('Direct content')).toHaveClass(customStyles, 'existing');
    expect(screen.getByText('Direct content')).not.toHaveAttribute('customCss');
  });

  const styling = {
    customCss: customStyles,
    className: 'existing',
    'data-test-id': 'styled-core',
  };
  const textStyling = {...styling, children: 'Styled text'};
  it.each([
    ['Container', createElement(Container, styling)],
    ['Grid', createElement(Grid, styling)],
    ['Stack', createElement(Stack, styling)],
    ['Surface', createElement(Surface, styling)],
    ['Text', createElement(Text, textStyling)],
    ['Heading', createElement(Heading, {...styling, as: 'h1'}, 'Heading')],
    ['Separator', createElement(Separator, {...styling, orientation: 'horizontal'})],
    ['Quote', createElement(Quote, textStyling)],
    ['IndeterminateLoader', createElement(IndeterminateLoader, styling)],
    ['InlineCode', createElement(InlineCode, styling, 'Code')],
    ['Kbd', createElement(Kbd, textStyling)],
    ['Button', createElement(Button, textStyling)],
    ['LinkButton', createElement(LinkButton, {...styling, to: '/'}, 'Link button')],
    ['DropdownButton', createElement(DropdownButton, textStyling)],
    ['Link', createElement(Link, {...styling, to: '/'}, 'Link')],
  ])('merges customCss and className inside %s', (_name, element) => {
    render(element);
    expect(screen.getByTestId('styled-core')).toHaveClass(customStyles, 'existing');
    expect(screen.getByTestId('styled-core')).not.toHaveAttribute('customCss');
  });

  it('keeps Emotion css working on other elements', () => {
    render(<div css={emotionCss`color: red;`}>Emotion content</div>);
    expect(screen.getByText('Emotion content').className).toMatch(/css-/);
  });

  it('rejects the css prop on all migrated components', () => {
    const themedCss = (emotionTheme: Theme) => emotionCss`
      color: ${emotionTheme.tokens.content.primary};
    `;

    // These JSX checks are validated by the top-level typecheck command.
    const invalidElements = [
      // @ts-expect-error Use customCss for Linaria styles.
      <Container key="Container" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <Flex key="Flex" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <Grid key="Grid" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <Stack key="Stack" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <Surface key="Surface" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <Text key="Text" css={themedCss}>
        Text
      </Text>,
      // @ts-expect-error Use customCss for Linaria styles.
      <Heading key="Heading" as="h1" css={themedCss}>
        Heading
      </Heading>,
      // @ts-expect-error Use customCss for Linaria styles.
      <Separator key="Separator" orientation="horizontal" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <Quote key="Quote" css={themedCss}>
        Quote
      </Quote>,
      // @ts-expect-error Use customCss for Linaria styles.
      <IndeterminateLoader key="IndeterminateLoader" css={themedCss} />,
      // @ts-expect-error Use customCss for Linaria styles.
      <InlineCode key="InlineCode" css={themedCss}>
        Code
      </InlineCode>,
      // @ts-expect-error Use customCss for Linaria styles.
      <Kbd key="Kbd" css={themedCss}>
        Key
      </Kbd>,
      // @ts-expect-error Use customCss for Linaria styles.
      <Button key="Button" css={themedCss}>
        Button
      </Button>,
      // @ts-expect-error Use customCss for Linaria styles.
      <LinkButton key="LinkButton" to="/" css={themedCss}>
        Link button
      </LinkButton>,
      // @ts-expect-error Use customCss for Linaria styles.
      <DropdownButton key="DropdownButton" css={themedCss}>
        Dropdown
      </DropdownButton>,
      // @ts-expect-error Use customCss for Linaria styles.
      <Link key="Link" to="/" css={themedCss}>
        Link
      </Link>,
    ];

    expect(invalidElements).toHaveLength(16);
  });

  it('requires LinariaClassName values in customCss', () => {
    const emotionStyles = emotionCss`color: red;`;
    const plainStyles = 'plain-class';
    const themedCss = (emotionTheme: Theme) => emotionCss`
      color: ${emotionTheme.tokens.content.primary};
    `;
    const invalidElements = [
      // @ts-expect-error Emotion objects are not supported on core components.
      <Flex key="Flex" customCss={emotionStyles} />,
      // @ts-expect-error Plain strings are not LinariaClassName values.
      <Flex key="plain" customCss={plainStyles} />,
      // @ts-expect-error Theme callbacks are not LinariaClassName values.
      <Flex key="theme" customCss={themedCss} />,
      // @ts-expect-error Linaria classes belong in customCss.
      <Flex key="css" css={customStyles} />,
    ];

    expect(invalidElements).toHaveLength(4);
  });

  it('provides typed theme paths with matching CSS variable names', () => {
    expect(theme.tokens.content.primary).toContain('var(--ln-content-primary,');
    expect(theme.tokens.background.transparent.accent.muted).toContain(
      'var(--ln-background-transparentAccentMuted,'
    );
    expect(theme.space.md).toBe('8px');

    // @ts-expect-error Unknown theme tokens must fail typechecking.
    const unknownToken = theme.tokens.content.unknown;
    expect(unknownToken).toBeUndefined();
  });
});

function extractedCustomRule() {
  return Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules))
    .find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && rule.selectorText === `.${customStyles}`
    );
}
