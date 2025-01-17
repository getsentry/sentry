import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import {Button} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {loadPrismLanguage} from 'sentry/utils/prism';

interface CodeSnippetProps {
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
  tabs?: {
    label: string;
    value: string;
  }[];
}

export function CodeSnippet({
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
}: CodeSnippetProps) {
  const ref = useRef<HTMLModElement | null>(null);

  // https://prismjs.com/plugins/line-highlight/
  useEffect(() => {
    if (linesToHighlight) {
      // @ts-ignore TS(7016): Could not find a declaration file for module 'pris... Remove this comment to see the full error message
      import('prismjs/plugins/line-highlight/prism-line-highlight');
    }
  }, [linesToHighlight]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (!language) {
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
  }, [children, language, onAfterHighlight]);

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
  const hasSolidHeader = !!(filename || hasTabs);

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
        ? t('Copied')
        : t('Unable to copy');

  return (
    <Wrapper
      isRounded={isRounded}
      className={`${dark ? 'prism-dark ' : ''}${className ?? ''}`}
      data-render-inline={dataRenderInline}
    >
      <Header isSolid={hasSolidHeader}>
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
            translucentBorder
            borderless
            onClick={handleCopy}
            title={tooltipTitle}
            tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
            onMouseLeave={() => setTooltipState('copy')}
            isAlwaysVisible={hasSolidHeader}
          >
            <IconCopy size="xs" />
          </CopyButton>
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
}

const Wrapper = styled('div')<{isRounded: boolean}>`
  position: relative;
  background: var(--prism-block-background);
  border-radius: ${p => (p.isRounded ? p.theme.borderRadius : '0px')};

  pre {
    margin: 0;
  }

  &[data-render-inline='true'] pre {
    padding: 0;
  }
`;

const Header = styled('div')<{isSolid: boolean}>`
  display: flex;
  align-items: center;

  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: var(--prism-base);
  font-weight: ${p => p.theme.fontWeightBold};
  z-index: 2;

  ${p =>
    p.isSolid
      ? `
      padding: 0 ${space(0.5)};
      border-bottom: solid 1px ${p.theme.innerBorder};
    `
      : `
      justify-content: flex-end;
      position: absolute;
      top: 0;
      right: 0;
      width: max-content;
      height: max-content;
      max-height: 100%;
      padding: ${space(0.5)};
    `}
`;

const FileName = styled('span')`
  ${p => p.theme.overflowEllipsis}
  padding: ${space(0.5)} ${space(0.5)};
  margin: 0;
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
      ? `border-bottom: 3px solid ${p.theme.purple300};
      padding-bottom: 5px;
      color: var(--prism-base);`
      : ''}
`;

const FlexSpacer = styled('div')`
  flex-grow: 1;
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
