import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface WidgetDescriptionProps {
  description?: React.ReactElement | string;
  revealTooltip?: 'hover' | 'always';
  title?: string;
}

export function WidgetDescription(props: WidgetDescriptionProps) {
  return (
    <Tooltip
      title={
        <WidgetTooltipContents>
          {props.title && <WidgetTooltipTitle>{props.title}</WidgetTooltipTitle>}
          {props.description && (
            <WidgetTooltipDescription>{props.description}</WidgetTooltipDescription>
          )}
        </WidgetTooltipContents>
      }
      containerDisplayMode="grid"
      isHoverable
      forceVisible={props.revealTooltip === 'always' ? true : undefined}
    >
      <WidgetTooltipButton
        aria-label={t('Widget description')}
        borderless
        size="xs"
        icon={<IconInfo size="sm" />}
      />
    </Tooltip>
  );
}

const WidgetTooltipContents = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  max-height: 33vh;
  overflow: hidden;
`;

const WidgetTooltipTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: left;
`;

const WidgetTooltipDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: left;
`;

// We're using a button here to preserve tab accessibility
const WidgetTooltipButton = styled(Button)`
  pointer-events: none;
  padding-top: 0;
  padding-bottom: 0;
`;
