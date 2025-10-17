import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type FilterConflictWarningProps = {
  conflictingFilterKeys: string[];
};

export function FilterConflictWarning({
  conflictingFilterKeys,
}: FilterConflictWarningProps) {
  return (
    <Tooltip
      title={
        <TooltipContents>
          <TooltipTitle>{t('Filter conflict')}</TooltipTitle>

          <TooltipDescription>
            {t('You have conflicting global and widget filters:')}
          </TooltipDescription>
          <TooltipDescription>{conflictingFilterKeys.join(', ')}</TooltipDescription>
        </TooltipContents>
      }
      containerDisplayMode="grid"
      isHoverable
    >
      <TooltipButton
        aria-label={t('Global filter conflict')}
        borderless
        size="xs"
        icon={<IconWarning size="sm" color="yellow300" />}
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

const TooltipButton = styled(Button)`
  pointer-events: none;
  padding-top: 0;
  padding-bottom: 0;
`;
