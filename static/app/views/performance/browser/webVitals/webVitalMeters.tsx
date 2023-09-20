import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {MeterBar} from 'sentry/views/performance/browser/webVitals/meterBar';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  projectData: any;
  // TODO: type
  projectScore: ProjectScore;
  onClick?: (webVital: WebVitals) => void;
};

export default function WebVitalMeters({onClick, projectData, projectScore}: Props) {
  return (
    <Container>
      <Flex>
        <MeterBarContainer key="lcp" onClick={() => onClick?.('lcp')}>
          <MeterHeader>
            <Flex>
              <span>
                LCP{' '}
                <Tooltip title="Largest Contentful Paint">
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
            total={100}
            meterText={
              getDuration(
                (projectData?.data[0]['p75(measurements.lcp)'] as number) / 1000
              ) ?? ''
            }
          />
        </MeterBarContainer>
        <MeterBarContainer key="fcp" onClick={() => onClick?.('fcp')}>
          <MeterHeader>
            <Flex>
              <span>
                FCP{' '}
                <Tooltip title="First Contentful Paint">
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
            total={100}
            meterText={
              getDuration(
                (projectData?.data[0]['p75(measurements.fcp)'] as number) / 1000
              ) ?? ''
            }
          />
        </MeterBarContainer>
        <MeterBarContainer key="cls" onClick={() => onClick?.('cls')}>
          <MeterHeader>
            <Flex>
              <span>
                CLS{' '}
                <Tooltip title="Content Layout Shift">
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
            total={100}
            meterText={formatAbbreviatedNumber(
              projectData?.data[0]['p75(measurements.cls)'] as number,
              2
            )}
          />
        </MeterBarContainer>
        <MeterBarContainer key="tbt" onClick={() => onClick?.('tbt')}>
          <MeterHeader>
            <Flex>
              <span>
                TBT{' '}
                <Tooltip title="Total Blocking Time">
                  <StyledIconQuestion size="xs" />
                </Tooltip>
              </span>
              <span>
                <StyledIconOpen size="xs" />
              </span>
            </Flex>
          </MeterHeader>
          <MeterBar
            meterItems={['tbtScore']}
            minWidth={0.1}
            row={projectScore}
            total={100}
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
