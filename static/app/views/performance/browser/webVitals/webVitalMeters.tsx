import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {MeterBar} from 'sentry/views/performance/browser/webVitals/meterBar';
import {
  CLS_MAX_SCORE,
  FCP_MAX_SCORE,
  LCP_MAX_SCORE,
  LONG_TASK_MAX_SCORE,
  ProjectScore,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';

type Props = {
  projectData: any; // TODO: type
  projectScore: ProjectScore;
};

export default function WebVitalMeters({projectData, projectScore}: Props) {
  return (
    <Container>
      <Flex>
        <MeterBarContainer key="lcp">
          <MeterHeader>
            <Flex>
              <span>
                LCP{' '}
                <Tooltip title="LCP">
                  <StyledIconQuestion size="xs" />
                </Tooltip>
              </span>
              <span>
                <StyledIconOpen size="xs" />
              </span>
            </Flex>
          </MeterHeader>
          <MeterBar
            meterItems={['lcpScore']}
            minWidth={0.1}
            row={projectScore}
            total={LCP_MAX_SCORE}
            meterText={
              getDuration(
                (projectData?.data[0]['p75(measurements.lcp)'] as number) / 1000
              ) ?? ''
            }
          />
        </MeterBarContainer>
        <MeterBarContainer key="fcp">
          <MeterHeader>
            <Flex>
              <span>
                FCP{' '}
                <Tooltip title="FCP">
                  <StyledIconQuestion size="xs" />
                </Tooltip>
              </span>
              <span>
                <StyledIconOpen size="xs" />
              </span>
            </Flex>
          </MeterHeader>
          <MeterBar
            meterItems={['fcpScore']}
            minWidth={0.1}
            row={projectScore}
            total={FCP_MAX_SCORE}
            meterText={
              getDuration(
                (projectData?.data[0]['p75(measurements.fcp)'] as number) / 1000
              ) ?? ''
            }
          />
        </MeterBarContainer>
        <MeterBarContainer key="cls">
          <MeterHeader>
            <Flex>
              <span>
                CLS{' '}
                <Tooltip title="CLS">
                  <StyledIconQuestion size="xs" />
                </Tooltip>
              </span>
              <span>
                <StyledIconOpen size="xs" />
              </span>
            </Flex>
          </MeterHeader>
          <MeterBar
            meterItems={['clsScore']}
            minWidth={0.1}
            row={projectScore}
            total={CLS_MAX_SCORE}
            meterText={formatAbbreviatedNumber(
              projectData?.data[0]['p75(measurements.cls)'] as number,
              2
            )}
          />
        </MeterBarContainer>
        <MeterBarContainer key="longtask">
          <MeterHeader>
            <Flex>
              <span>
                Long Task{' '}
                <Tooltip title="Long Task">
                  <StyledIconQuestion size="xs" />
                </Tooltip>
              </span>
              <span>
                <StyledIconOpen size="xs" />
              </span>
            </Flex>
          </MeterHeader>
          <MeterBar
            meterItems={['longTaskScore']}
            minWidth={0.1}
            row={projectScore}
            total={LONG_TASK_MAX_SCORE}
            meterText={
              getDuration(
                (projectData?.data[0][
                  'p75(measurements.app_init_long_tasks)'
                ] as number) / 1000
              ) ?? ''
            }
          />
        </MeterBarContainer>
      </Flex>
    </Container>
  );
}

const Container = styled('div')`
  margin-top: ${space(2)};
`;

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(2)};
`;

const MeterBarContainer = styled('div')`
  flex: 1;
  top: -6px;
  position: relative;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
  cursor: pointer;
`;

const MeterHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
`;

const StyledIconQuestion = styled(IconQuestion)`
  position: relative;
  top: 1px;
`;

const StyledIconOpen = styled(IconOpen)`
  position: relative;
  top: 1px;
`;
