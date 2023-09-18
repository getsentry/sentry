import {Fragment, useEffect, useRef, useState} from 'react';
import {Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import {Button} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {prismStyles} from 'sentry/styles/prism';
import {space} from 'sentry/styles/space';
import {loadPrismLanguage} from 'sentry/utils/loadPrismLanguage';

interface CodeSnippetProps {
  children: string;
  language: string;
  className?: string;
  dark?: boolean;
  /**
   * Makes the text of the element and its sub-elements not selectable.
   * Userful when loading parts of a code snippet, and
   * we wish to avoid users copying them manually.
   */
  disableUserSelection?: boolean;
  filename?: string;
  hideCopyButton?: boolean;
  onCopy?: (copiedCode: string) => void;
  /**
   * Fired when the user selects and copies code snippet manually
   */
  onSelectAndCopy?: () => void;
  onTabClick?: (tab: string) => void;
  selectedTab?: string;
  tabs?: {
    label: string;
    value: string;
  }[];
}

const darkColors = {
  textColor: '#e0dce5',
  subText: '#80708f',
  border: '#40364a',
};

function getLightColors(theme: Theme) {
  return {
    textColor: theme.textColor,
    subText: theme.subText,
    border: theme.innerBorder,
  };
}

type Colors = typeof darkColors | ReturnType<typeof getLightColors>;

export function CodeSnippet({
  children,
  language,
  dark,
  filename,
  hideCopyButton,
  onCopy,
  className,
  onSelectAndCopy,
  disableUserSelection,
  selectedTab,
  onTabClick,
  tabs,
}: CodeSnippetProps) {
  const ref = useRef<HTMLModElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (language in Prism.languages) {
      Prism.highlightElement(element);
      return;
    }

    loadPrismLanguage(language, {onLoad: () => Prism.highlightElement(element)});
  }, [children, language]);

  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const handleCopy = () => {
    navigator.clipboard
      .writeText(children)
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

  const colors = dark ? darkColors : getLightColors(theme);

  return (
    <Wrapper className={`${dark ? 'prism-dark ' : ''}${className ?? ''}`}>
      <Header isSolid={hasSolidHeader} colors={colors}>
        {hasTabs && (
          <Fragment>
            <TabsWrapper>
              {tabs.map(({label, value}) => (
                <Tab
                  type="button"
                  isSelected={selectedTab === value}
                  onClick={() => onTabClick?.(value)}
                  key={value}
                  colors={colors}
                >
                  {label}
                </Tab>
              ))}
            </TabsWrapper>
            <FlexSpacer />
          </Fragment>
        )}
        {filename && <FileName>{filename}</FileName>}
        {!hasTabs && <FlexSpacer />}
        {!hideCopyButton && (
          <CopyButton
            type="button"
            size="xs"
            translucentBorder
            borderless
            colors={colors}
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

      <pre className={`language-${String(language)}`}>
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

const Wrapper = styled('div')`
  position: relative;
  background: var(--prism-block-background);
  border-radius: ${p => p.theme.borderRadius};

  ${p => prismStyles(p.theme)}
  pre {
    margin: 0;
  }
`;

const Header = styled('div')<{colors: Colors; isSolid: boolean}>`
  display: flex;
  align-items: center;

  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.colors.textColor};
  font-weight: 600;
  z-index: 2;

  ${p =>
    p.isSolid
      ? `
      margin: 0 ${space(0.5)};
      border-bottom: solid 1px ${p.colors.border};
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

const FileName = styled('p')`
  ${p => p.theme.overflowEllipsis}
  padding: ${space(0.5)} ${space(0.5)};
  margin: 0;
  width: auto;
`;

const TabsWrapper = styled('div')`
  padding: 0;
  display: flex;
`;

const Tab = styled('button')<{colors: Colors; isSelected: boolean}>`
  box-sizing: border-box;
  display: block;
  margin: 0;
  border: none;
  background: none;
  padding: ${space(1)} ${space(1)};
  color: ${p => p.colors.subText};
  ${p =>
    p.isSelected
      ? `border-bottom: 3px solid ${p.theme.purple300};
      padding-bottom: 5px;
      color: ${p.colors.textColor};`
      : ''}
`;

const FlexSpacer = styled('div')`
  flex-grow: 1;
`;

const CopyButton = styled(Button)<{colors: Colors; isAlwaysVisible: boolean}>`
  color: ${p => p.colors.subText};
  transition: opacity 0.1s ease-out;
  opacity: 0;

  div:hover > div > &, /* if Wrapper is hovered */
  &.focus-visible {
    opacity: 1;
  }
  &:hover {
    color: ${p => p.colors.textColor};
  }
  ${p => (p.isAlwaysVisible ? 'opacity: 1;' : '')}
`;

const Code = styled('code')<{disableUserSelection?: boolean}>`
  user-select: ${p => (p.disableUserSelection ? 'none' : 'auto')};
`;
