import {Fragment} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {space} from 'sentry/styles/space';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';

type Props = {
  description: string;
  formattedValue: string | undefined;
  status: string | undefined;
  statusLabel: string | undefined;
  title: string;
  onClick?: () => void;
};

function VitalCard({
  description,
  formattedValue,
  status,
  statusLabel,
  title,
  onClick,
}: Props) {
  return (
    <Fragment>
      <MeterBarContainer clickable={onClick !== undefined} onClick={onClick}>
        {onClick && <InteractionStateLayer />}
        <MeterBarBody>
          {description && (
            <StyledQuestionTooltip
              isHoverable
              size="xs"
              title={<span>{description}</span>}
            />
          )}
          <MeterHeader>{title}</MeterHeader>
          <MeterValueText>{formattedValue ?? '-'}</MeterValueText>
        </MeterBarBody>
        <MeterBarFooter
          label={statusLabel}
          status={status as keyof typeof PERFORMANCE_SCORE_COLORS}
        />
      </MeterBarContainer>
    </Fragment>
  );
}

const MeterBarContainer = styled('div')<{clickable?: boolean}>`
  flex: 1;
  position: relative;
  padding: 0;
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  min-width: 140px;
`;

const MeterBarBody = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  border-bottom: none;
  padding: ${space(1)} 0 ${space(0.5)} 0;
`;

const MeterHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  display: inline-block;
  text-align: center;
  width: 100%;
`;

const MeterValueText = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: center;
`;

function MeterBarFooter({
  label,
  status,
}: {
  label: string | undefined;
  status: keyof typeof PERFORMANCE_SCORE_COLORS | undefined;
}) {
  return (
    <MeterBarFooterContainer status={status || 'none'}>
      {label || '-'}
    </MeterBarFooterContainer>
  );
}

const MeterBarFooterContainer = styled('div')<{
  status: keyof typeof PERFORMANCE_SCORE_COLORS;
}>`
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  background-color: ${p =>
    p.status === 'none' ? 'none' : p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.5)};
  text-align: center;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  position: absolute;
  right: ${space(1)};
`;

export default VitalCard;
