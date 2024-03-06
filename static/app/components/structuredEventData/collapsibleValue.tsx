import {Children, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type CollapsibleValueProps = {
  children: React.ReactNode;
  closeTag: string;
  depth: number;
  maxDefaultDepth: number;
  openTag: string;
  prefix?: React.ReactNode;
};

const MAX_ITEMS_BEFORE_AUTOCOLLAPSE = 5;

export function CollapsibleValue({
  children,
  openTag,
  closeTag,
  prefix = null,
  depth,
  maxDefaultDepth,
}: CollapsibleValueProps) {
  const numChildren = Children.count(children);
  const [isExpanded, setIsExpanded] = useState(
    numChildren <= MAX_ITEMS_BEFORE_AUTOCOLLAPSE && depth < maxDefaultDepth
  );

  const shouldShowToggleButton = numChildren > 0;
  const isBaseLevel = depth === 0;

  // Toggle buttons get placed to the left of the open tag, but if this is the
  // base level there is no room for it. So we add padding in this case.
  const baseLevelPadding = isBaseLevel && shouldShowToggleButton;

  return (
    <CollapsibleDataContainer baseLevelPadding={baseLevelPadding}>
      {numChildren > 0 ? (
        <ToggleButton
          size="zero"
          aria-label={isExpanded ? t('Collapse') : t('Expand')}
          onClick={() => setIsExpanded(oldValue => !oldValue)}
          icon={
            <IconChevron direction={isExpanded ? 'down' : 'right'} legacySize="10px" />
          }
          borderless
          baseLevelPadding={baseLevelPadding}
        />
      ) : null}
      {prefix}
      <span>{openTag}</span>
      {shouldShowToggleButton && !isExpanded ? (
        <NumItemsButton size="zero" onClick={() => setIsExpanded(true)}>
          {tn('%s item', '%s items', numChildren)}
        </NumItemsButton>
      ) : null}
      {shouldShowToggleButton && isExpanded ? (
        <IndentedValues>{children}</IndentedValues>
      ) : null}
      <span>{closeTag}</span>
    </CollapsibleDataContainer>
  );
}

const CollapsibleDataContainer = styled('span')<{baseLevelPadding: boolean}>`
  position: relative;

  ${p =>
    p.baseLevelPadding &&
    css`
      display: block;
      padding-left: ${space(3)};
    `}
`;

const IndentedValues = styled('div')`
  padding-left: ${space(1.5)};
`;

const NumItemsButton = styled(Button)`
  background: none;
  border: none;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: normal;
  box-shadow: none;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin: 0 ${space(0.5)};
`;

const ToggleButton = styled(Button)<{baseLevelPadding: boolean}>`
  position: absolute;
  left: -${space(3)};
  top: 2px;
  border-radius: 2px;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;

  ${p =>
    p.baseLevelPadding &&
    css`
      left: 0;
    `}
`;
