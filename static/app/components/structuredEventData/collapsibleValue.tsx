import {Children, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import useExpandedState from 'sentry/components/structuredEventData/useExpandedState';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  children: ReactNode;
  closeTag: string;
  openTag: string;
  path: string;
  noBasePadding?: boolean;
  prefix?: ReactNode;
  /**
   * If provided, indicates the total number of children available on the
   * server-side, which may be greater than the rendered children when data
   * has been truncated upstream.
   */
  totalChildren?: number;
}

export function CollapsibleValue({
  children,
  closeTag,
  openTag,
  path,
  prefix = null,
  noBasePadding,
  totalChildren,
}: Props) {
  const {collapse, expand, isExpanded: isInitiallyExpanded} = useExpandedState({path});
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  const numChildren = Children.count(children);
  const totalCount = typeof totalChildren === 'number' ? totalChildren : numChildren;
  const hiddenCount = Math.max(0, totalCount - numChildren);

  const shouldShowToggleButton = numChildren > 0;
  const isBaseLevel = path === '$';

  // Toggle buttons get placed to the left of the open tag, but if this is the
  // base level there is no room for it. So we add padding in this case.
  const baseLevelPadding = isBaseLevel && shouldShowToggleButton && !noBasePadding;

  return (
    <CollapsibleDataContainer data-base-with-toggle={baseLevelPadding}>
      {numChildren > 0 ? (
        <ToggleButton
          size="zero"
          aria-label={isExpanded ? t('Collapse') : t('Expand')}
          onClick={() => {
            if (isExpanded) {
              collapse();
              setIsExpanded(false);
            } else {
              expand();
              setIsExpanded(true);
            }
          }}
          icon={
            <IconChevron direction={isExpanded ? 'down' : 'right'} legacySize="10px" />
          }
          borderless
          data-base-with-toggle={baseLevelPadding}
        />
      ) : null}
      {prefix}
      <span>{openTag}</span>
      {shouldShowToggleButton && !isExpanded ? (
        <NumItemsButton
          size="zero"
          priority="transparent"
          onClick={() => {
            expand();
            setIsExpanded(true);
          }}
        >
          {tn('%s item', '%s items', numChildren + hiddenCount)}
        </NumItemsButton>
      ) : null}
      {shouldShowToggleButton && isExpanded ? (
        <IndentedValues>{children}</IndentedValues>
      ) : null}
      <span>{closeTag}</span>
      {isExpanded && hiddenCount > 0 ? (
        <Text
          variant="muted"
          size="xs"
        >{` (${tn('%s item truncated', '%s items truncated', hiddenCount)})`}</Text>
      ) : null}
    </CollapsibleDataContainer>
  );
}

const CollapsibleDataContainer = styled('span')`
  position: relative;

  &[data-base-with-toggle='true'] {
    display: block;
    padding-left: ${space(3)};
  }
`;

const IndentedValues = styled('div')`
  padding-left: ${space(1.5)};
`;

const NumItemsButton = styled(Button)`
  background: none;
  border: none;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: ${p => p.theme.fontWeight.normal};
  box-shadow: none;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  margin: 0 ${space(0.5)};

  height: 18px;
  min-height: 18px;
`;

const ToggleButton = styled(Button)`
  position: absolute;
  left: -${space(3)};
  top: 0px;
  border-radius: 2px;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  height: 18px;
  width: 18px;
  min-height: 18px;

  &[data-base-with-toggle='true'] {
    left: 0;
  }
`;
