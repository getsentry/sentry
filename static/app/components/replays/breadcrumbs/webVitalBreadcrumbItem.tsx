import {Children, type ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import useExpandedState from 'sentry/components/structuredEventData/useExpandedState';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';

interface Props {
  badCount: number;
  children: ReactNode;
  goodCount: number;
  mehCount: number;
  path: string;
}

export function WebVitalCollapsible({
  children,
  path,
  goodCount,
  mehCount,
  badCount,
}: Props) {
  const {collapse, expand, isExpanded: isInitiallyExpanded} = useExpandedState({path});
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const numChildren = Children.count(children);

  const shouldShowToggleButton = numChildren > 0;
  const isBaseLevel = path === '$';

  // Toggle buttons get placed to the left of the open tag, but if this is the
  // base level there is no room for it. So we add padding in this case.
  const baseLevelPadding = isBaseLevel && shouldShowToggleButton;

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.7rem',
        }}
      >
        {t('Web Vital')}
        <span>
          <PerformanceBadge score={100} displayValue={goodCount} />
          <PerformanceBadge score={50} displayValue={mehCount} />
          <PerformanceBadge score={0} displayValue={badCount} />
        </span>
      </div>
      {shouldShowToggleButton && isExpanded ? (
        <IndentedValues>{children}</IndentedValues>
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
