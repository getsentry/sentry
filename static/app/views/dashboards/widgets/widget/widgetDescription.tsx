import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface WidgetDescriptionProps {
  description?: React.ReactNode;
  revealTooltip?: 'hover' | 'always';
  title?: string;
}

export function WidgetDescription(props: WidgetDescriptionProps) {
  return (
    <Tooltip
      title={
        <TooltipContents>
          {props.title && <TooltipTitle>{props.title}</TooltipTitle>}
          {props.description && (
            <TooltipDescription>{props.description}</TooltipDescription>
          )}
        </TooltipContents>
      }
      containerDisplayMode="grid"
      isHoverable
      forceVisible={props.revealTooltip === 'always' ? true : undefined}
    >
      <TooltipButton
        aria-label={t('Widget description')}
        borderless
        size="xs"
        icon={<IconInfo size="sm" />}
      />
    </Tooltip>
  );
}

const TooltipContents = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  max-height: 33vh;
  overflow: hidden;
`;

const TooltipTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSize.md};
  text-align: left;
`;

const TooltipDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  text-align: left;
`;

// We're using a button here to preserve tab accessibility
const TooltipButton = styled(Button)`
  pointer-events: none;
  padding-top: 0;
  padding-bottom: 0;
`;
