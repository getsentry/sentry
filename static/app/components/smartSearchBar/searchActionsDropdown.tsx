import React from 'react';
import {usePopper} from 'react-popper';
import styled from '@emotion/styled';
import throttle from 'lodash/throttle';

import {IconStar} from 'sentry/icons';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {getFieldDoc} from 'sentry/utils/discover/fields';

import {Token, TokenResult} from '../searchSyntax/parser';

import {commonActions, TokenAction} from './types';

const SearchActionsDropdown = ({
  activeToken,
  filterElementRef,
  deselect,
  runTokenAction,
}: {
  activeToken: TokenResult<Token.Filter>;
  deselect: () => void;
  filterElementRef: React.RefObject<HTMLSpanElement>;
  runTokenAction: (action: TokenAction) => void;
}) => {
  const [referenceElement, setReferenceElement] = React.useState<HTMLDivElement | null>(
    null
  );
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null);
  const [arrowElement, setArrowElement] = React.useState<HTMLSpanElement | null>(null);
  const {styles, attributes} = usePopper(referenceElement, popperElement, {
    modifiers: [{name: 'arrow', options: {element: arrowElement}}],
  });

  const mouseHasEntered = React.useRef(false);

  React.useEffect(() => {
    // @ts-ignore
    setReferenceElement(filterElementRef.current);

    const rect = filterElementRef.current?.getBoundingClientRect();

    const listener = throttle(e => {
      if (!mouseHasEntered.current && rect) {
        if (
          e.pageX < rect.left ||
          e.pageX > rect.right ||
          e.pageY < rect.top ||
          e.pageY > rect.bottom + ARROW_SIZE
        ) {
          deselect();
        }
      }
    }, 200);

    document.addEventListener('mouseover', listener);

    return () => document.removeEventListener('mouseover', listener);
  }, [deselect, filterElementRef]);

  const doc = getFieldDoc?.(activeToken.key.text);
  return (
    <React.Fragment>
      <StyledSearchDropdown
        ref={setPopperElement}
        style={styles.popper}
        {...attributes.popper}
        onMouseEnter={() => {
          mouseHasEntered.current = true;
        }}
        onMouseLeave={() => {
          if (mouseHasEntered.current) {
            mouseHasEntered.current = false;
            deselect();
          }
        }}
      >
        <TooltipArrow
          ref={setArrowElement}
          data-placement={attributes.placement}
          style={styles.arrow}
        />
        <DropdownContent>
          {doc && (
            <DocumentationText>
              {/* <IconQuestion color="gray200" size="xs" /> */}
              {/* <DocumentationKey>{}</DocumentationKey> */}

              <DocumentationKey>{activeToken.key.text}: </DocumentationKey>
              {doc}
            </DocumentationText>
          )}
          <SearchDropdownGroup>
            <SearchDropdownGroupTitle>
              <IconStar size="xs" />
              Common Actions
            </SearchDropdownGroupTitle>
            {commonActions.map(action => {
              return (
                <DropdownAction
                  key={action.text}
                  text={action.text}
                  onClick={() => {
                    runTokenAction({
                      type: action.actionType,
                      token: activeToken,
                    });
                  }}
                  shortcut={action.shortcut}
                />
              );
            })}
          </SearchDropdownGroup>
        </DropdownContent>
      </StyledSearchDropdown>
    </React.Fragment>
  );
};

export default SearchActionsDropdown;

const StyledSearchDropdown = styled('div')`
  /* Container has a border that we need to account for */
  position: absolute;
  top: 100%;
  left: 0px;
  width: 250px;
  z-index: ${p => p.theme.zIndex.dropdown};
  margin-top: ${space(1)};
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.family};
  pointer-events: auto;
`;

const ListItem = styled('li')`
  list-style-type: none;
`;

const SearchDropdownGroup = styled(ListItem)`
  > *:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const SearchDropdownGroupTitle = styled('header')`
  display: flex;
  align-items: center;

  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};

  margin: 0;
  padding: ${space(1)} ${space(2)};

  > * {
    margin-right: ${space(1)};
  }
`;

const DropdownContent = styled('div')`
  display: flex;
  flex-direction: column;
  pointer-events: auto;
`;

const DropdownAction = ({
  text,
  shortcut,
  onClick,
}: {
  onClick: () => void;
  shortcut: {glyph?: string; text?: string}[];
  text: string;
}) => {
  return (
    <DropdownActionContainer onClick={onClick}>
      <SearchItemTitleWrapper>{text}</SearchItemTitleWrapper>
      <ShortcutContainer>
        {shortcut.map((key, i) => (
          <React.Fragment key={key.text}>
            {key.text}
            {key.glyph && <GlyphKbd>{key.glyph}</GlyphKbd>}
            {i !== shortcut.length - 1 && <span>+</span>}
          </React.Fragment>
        ))}
      </ShortcutContainer>
    </DropdownActionContainer>
  );
};

const DropdownActionContainer = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(1)} ${space(2)};
  cursor: pointer;

  &:hover,
  &.active {
    background: ${p => p.theme.hover};
  }
  pointer-events: auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const ShortcutContainer = styled('span')`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};

  color: ${p => p.theme.subText};
  width: auto;
  flex-shrink: 0;

  span {
    margin: 0px 2px;
  }
`;

const GlyphKbd = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const SearchItemTitleWrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  line-height: ${p => p.theme.text.lineHeightHeading};

  ${overflowEllipsis};
`;

const DocumentationText = styled('p')`
  padding: ${space(1)} ${space(2)};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.gray300};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  font-size: ${p => p.theme.fontSizeMedium};

  margin: 0;
`;

const ARROW_SIZE = 11;

const TooltipArrow = styled('span')`
  pointer-events: none;
  position: absolute;
  width: ${ARROW_SIZE}px;
  height: ${ARROW_SIZE}px;

  &::before,
  &::after {
    content: '';
    display: block;
    position: absolute;
    height: ${ARROW_SIZE}px;
    width: ${ARROW_SIZE}px;
    border: solid 6px transparent;
  }

  top: -${ARROW_SIZE}px;
  &::before {
    bottom: 1px;
    border-bottom-color: ${p => p.theme.translucentBorder};
  }
  &::after {
    border-bottom-color: ${p => p.theme.backgroundElevated};
  }
`;

const DocumentationKey = styled(`b`)`
  color: ${p => p.theme.textColor};
  font-weight: bold;
`;
