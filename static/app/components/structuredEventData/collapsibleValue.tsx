import {Children, type ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
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
}

export function CollapsibleValue({
  children,
  closeTag,
  openTag,
  path,
  prefix = null,
  noBasePadding,
}: Props) {
  const {collapse, expand, isExpanded: isInitiallyExpanded} = useExpandedState({path});
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  const numChildren = Children.count(children);

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
          onClick={() => {
            expand();
            setIsExpanded(true);
          }}
        >
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
  font-weight: ${p => p.theme.fontWeightNormal};
  box-shadow: none;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin: 0 ${space(0.5)};
`;

const ToggleButton = styled(Button)`
  position: absolute;
  left: -${space(3)};
  top: 2px;
  border-radius: 2px;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;

  &[data-base-with-toggle='true'] {
    left: 0;
  }
`;
