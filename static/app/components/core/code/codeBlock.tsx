import {Fragment, useEffect, useRef, useState} from 'react';
import {css, ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import {Button} from 'sentry/components/core/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getPrismLanguage, loadPrismLanguage} from 'sentry/utils/prism';
// eslint-disable-next-line no-restricted-imports
import {darkTheme} from 'sentry/utils/theme/theme';

interface CodeBlockProps {
  children: string;
  className?: string;
  dark?: boolean;
  ['data-render-inline']?: boolean;
  /**
   * Makes the text of the element and its sub-elements not selectable.
   * Useful when loading parts of a code snippet, and
   * we wish to avoid users copying them manually.
   */
  disableUserSelection?: boolean;
  /**
   * Name of the file to be displayed at the top of the code snippet.
   */
  filename?: string;
  /**
   * Hides the copy button in the top right.
   */
  hideCopyButton?: boolean;
  /**
   * Adds an icon to the top right, next to the copy button.
   */
  icon?: React.ReactNode;
  /**
   * Controls whether the snippet wrapper has rounded corners.
   */
  isRounded?: boolean;
  language?: string;
  /**
   * Line numbers of the code that will be visually highlighted.
   */
  linesToHighlight?: number[];
  /**
   * Fires after the code snippet is highlighted and all DOM nodes are available
   * @param element The root element of the code snippet
   */
  onAfterHighlight?: (element: HTMLElement) => void;
  /**
   * Fires with the user presses the copy button.
   */
  onCopy?: (copiedCode: string) => void;
  /**
   * Fires when the user selects and copies code snippet manually
   */
  onSelectAndCopy?: () => void;
  /**
   * Fires when the user switches tabs.
   */
  onTabClick?: (tab: string) => void;
  selectedTab?: string;
  tabs?: Array<{
    label: string;
    value: string;
  }>;
}

export function CodeBlock({
  children,
  className,
  dark,
  'data-render-inline': dataRenderInline,
  disableUserSelection,
  filename,
  hideCopyButton,
  language,
  linesToHighlight,
  icon,
  isRounded = true,
  onAfterHighlight,
  onCopy,
  onSelectAndCopy,
  onTabClick,
  selectedTab,
  tabs,
}: CodeBlockProps) {
  const ref = useRef<HTMLModElement | null>(null);
  const theme = useTheme();

  const [lineHighlightLoaded, setLineHighlightLoaded] = useState(false);

  // https://prismjs.com/plugins/line-highlight/
  useEffect(() => {
    async function loadLineHighlight() {
      // @ts-expect-error TS(7016): Could not find a declaration file for module 'pris... Remove this comment to see the full error message
      await import('prismjs/plugins/line-highlight/prism-line-highlight');
      setLineHighlightLoaded(true);
    }

    if (linesToHighlight) {
      loadLineHighlight();
    }
  }, [linesToHighlight]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // Skip if no language or if language is not a valid Prism language (e.g. "text")
    if (!language || !getPrismLanguage(language)) {
      return;
    }

    if (language in Prism.languages) {
      Prism.highlightElement(element, false, () => onAfterHighlight?.(element));
      return;
    }

    loadPrismLanguage(language, {
      onLoad: () =>
        Prism.highlightElement(element, false, () => onAfterHighlight?.(element)),
    });
  }, [children, language, onAfterHighlight, lineHighlightLoaded]);

  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const handleCopy = () => {
    navigator.clipboard
      .writeText(ref.current?.textContent ?? '')
      .then(() => {
        setTooltipState('copied');
      })
      .catch(() => {
        setTooltipState('error');
      });
    onCopy?.(children);
  };

  const hasTabs = tabs && tabs.length > 0;
  const hasFloatingHeader = !(filename || hasTabs);

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
        ? t('Copied')
        : t('Unable to copy');

  const snippet = (
    <Wrapper
      isRounded={isRounded}
      className={`${dark ? 'prism-dark ' : ''}${className ?? ''}`}
      data-render-inline={dataRenderInline}
    >
      <Header isFloating={hasFloatingHeader}>
        {hasTabs && (
          <Fragment>
            <TabsWrapper>
              {tabs.map(({label, value}) => (
                <Tab
                  type="button"
                  isSelected={selectedTab === value}
                  onClick={() => onTabClick?.(value)}
                  key={value}
                >
                  {label}
                </Tab>
              ))}
            </TabsWrapper>
            <FlexSpacer />
          </Fragment>
        )}
        {icon}
        {filename && <FileName>{filename}</FileName>}
        {!hasTabs && <FlexSpacer />}
        {!hideCopyButton && (
          <CopyButton
            type="button"
            size="xs"
            borderless
            onClick={handleCopy}
            title={tooltipTitle}
            tooltipProps={{position: 'left'}}
            onMouseLeave={() => setTooltipState('copy')}
            isAlwaysVisible={!hasFloatingHeader || (!!icon && hasFloatingHeader)}
            aria-label={t('Copy snippet')}
            icon={<IconCopy />}
          />
        )}
      </Header>

      <pre
        className={`language-${String(language)}`}
        data-line={linesToHighlight?.join(',')}
      >
        <Code
          ref={ref}
          className={`language-${String(language)}`}
          onCopy={onSelectAndCopy}
          disableUserSelection={disableUserSelection}
        >
          {children}
        </Code>
      </pre>
    </Wrapper>
  );

  // Override theme provider when in dark mode to provider dark theme to
  // components
  return <ThemeProvider theme={dark ? darkTheme : theme}>{snippet}</ThemeProvider>;
}

const FlexSpacer = styled('div')`
  flex-grow: 1;
`;

const Wrapper = styled('div')<{isRounded: boolean}>`
  position: relative;
  height: 100%;
  background: var(--prism-block-background);
  border-radius: ${p => (p.isRounded ? p.theme.radius.md : '0px')};

  pre {
    margin: 0;
    height: 100%;
  }

  &[data-render-inline='true'] pre {
    padding: 0;
  }
`;

const Header = styled('div')<{isFloating: boolean}>`
  display: flex;
  align-items: center;

  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: var(--prism-base);
  font-weight: ${p => p.theme.font.weight.mono.medium};
  z-index: 2;

  ${p =>
    p.isFloating
      ? css`
          gap: ${space(0.25)};
          justify-content: flex-end;
          position: absolute;
          top: 0;
          right: 0;
          width: max-content;
          height: max-content;
          max-height: 100%;
          padding: ${space(0.5)};
        `
      : css`
          gap: ${space(0.75)};
          padding: ${space(0.5)} ${space(0.5)} 0 ${space(1)};
          border-bottom: solid 1px ${p.theme.border};
        `}
`;

const FileName = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const TabsWrapper = styled('div')`
  padding: 0;
  display: flex;
`;

const Tab = styled('button')<{isSelected: boolean}>`
  box-sizing: border-box;
  display: block;
  margin: 0;
  border: none;
  background: none;
  padding: ${space(1)} ${space(1)};
  color: var(--prism-comment);
  ${p =>
    p.isSelected
      ? `border-bottom: 3px solid ${p.theme.tokens.graphics.accent.vibrant};
      padding-bottom: 5px;
      color: var(--prism-base);`
      : ''}
`;

const CopyButton = styled(Button)<{isAlwaysVisible: boolean}>`
  color: var(--prism-comment);
  transition: opacity 0.1s ease-out;
  opacity: 0;

  div:hover > div > &, /* if Wrapper is hovered */
  &:focus-visible {
    opacity: 1;
  }
  &:hover {
    color: var(--prism-base);
  }
  ${p => (p.isAlwaysVisible ? 'opacity: 1;' : '')}
`;

const Code = styled('code')<{disableUserSelection?: boolean}>`
  user-select: ${p => (p.disableUserSelection ? 'none' : 'auto')};
`;
