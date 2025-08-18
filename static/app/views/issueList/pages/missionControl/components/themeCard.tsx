import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import Count from 'sentry/components/count';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ThemeCardData} from 'sentry/views/issueList/pages/missionControl/types';

interface ThemeCardProps {
  data: ThemeCardData;
  isCoreProblem?: boolean;
  onClick?: () => void;
}

// Helper function to get color based on issue count
function getIssueCountColor(count: number, theme: any) {
  // Issues: Lower thresholds since each issue represents a distinct problem
  if (count < 2) return theme.gray300;
  if (count < 5) return theme.yellow300;
  if (count < 10) return theme.yellow400;
  if (count < 20) return theme.red400;
  return theme.red300;
}

// Helper function to get color based on event count
function getEventCountColor(count: number, theme: any) {
  // Events: Higher thresholds since events can occur frequently
  if (count < 10) return theme.gray300;
  if (count < 100) return theme.yellow300;
  if (count < 1000) return theme.red400;
  return theme.red300;
}

function ThemeCard({data, onClick, isCoreProblem}: ThemeCardProps) {
  const {ultragroup, issueCount, totalEvents} = data;
  const {title, description} = ultragroup;

  return (
    <CardContainer
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      clickable={!!onClick}
      onKeyDown={
        onClick
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Content>
        <TextSection>
          <Title size="lg" bold isCoreProblem={isCoreProblem}>
            {title}
          </Title>
          <Description>{description}</Description>
        </TextSection>

        <StatsSection>
          <StatItem>
            <StatValue size="lg" bold count={issueCount} type="issue">
              <Count value={issueCount} />
            </StatValue>
            <StatLabel size="xs">{tn('issue', 'Issues', issueCount)}</StatLabel>
          </StatItem>

          <StatItem>
            <StatValue size="lg" bold count={totalEvents} type="event">
              <Count value={totalEvents} />
            </StatValue>
            <StatLabel size="xs">{tn('event', 'Events', totalEvents)}</StatLabel>
          </StatItem>
        </StatsSection>
      </Content>
    </CardContainer>
  );
}

const CardContainer = styled('div')<{clickable: boolean}>`
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: ${space(2)};
  height: 180px;
  width: 400px;

  ${p =>
    p.clickable &&
    `
    cursor: pointer;

    &:hover {
      background: ${p.theme.backgroundSecondary};
    }
  `}
`;

const Content = styled('div')`
  display: flex;
  height: 100%;
  gap: ${space(3)};
`;

const TextSection = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  min-width: 200px;
`;

const Title = styled(Text)<{isCoreProblem?: boolean}>`
  word-break: break-word;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: ${p =>
    p.isCoreProblem ? p.theme.fontWeight.bold : p.theme.fontWeight.normal};
`;

const Description = styled('p')`
  flex: 1;
  margin: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};

  max-width: 100%;
  white-space: normal;
`;

const StatsSection = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${space(3)};
  flex-shrink: 0;
  width: 80px;
  border-left: 1px solid ${p => p.theme.innerBorder};
  padding-left: ${space(2)};
`;

const StatItem = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.5)};
  text-align: center;
`;

const StatValue = styled(Text)<{count: number; type: 'issue' | 'event'}>`
  color: ${p =>
    p.type === 'issue'
      ? getIssueCountColor(p.count, p.theme)
      : getEventCountColor(p.count, p.theme)};
`;

const StatLabel = styled(Text)``;

export default ThemeCard;
