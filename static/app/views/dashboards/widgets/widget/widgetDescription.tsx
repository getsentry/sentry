import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

export interface WidgetDescriptionProps {
  description?: React.ReactNode;
  revealTooltip?: 'hover' | 'always';
  title?: string;
}

export function WidgetDescription(props: WidgetDescriptionProps) {
  return (
    <Tooltip
      title={
        <Stack gap="xs" maxHeight="33vh" overflow="hidden">
          {props.title && <TooltipTitle>{props.title}</TooltipTitle>}
          {props.description && (
            <TooltipDescription>{props.description}</TooltipDescription>
          )}
        </Stack>
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
