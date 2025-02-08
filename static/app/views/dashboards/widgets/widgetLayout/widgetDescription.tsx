import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface WidgetDescriptionProps {
  description?: React.ReactElement | string;
  forceDescriptionTooltip?: boolean;
  title?: string;
}

export function WidgetDescription(props: WidgetDescriptionProps) {
  return (
    <Tooltip
      title={
        <span>
          {props.title && <WidgetTooltipTitle>{props.title}</WidgetTooltipTitle>}
          {props.description && (
            <WidgetTooltipDescription>{props.description}</WidgetTooltipDescription>
          )}
        </span>
      }
      containerDisplayMode="grid"
      isHoverable
      forceVisible={props.forceDescriptionTooltip}
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

const WidgetTooltipTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: left;
`;

const WidgetTooltipDescription = styled('div')`
  margin-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: left;
`;

// We're using a button here to preserve tab accessibility
const WidgetTooltipButton = styled(Button)`
  pointer-events: none;
  padding-top: 0;
  padding-bottom: 0;
`;
