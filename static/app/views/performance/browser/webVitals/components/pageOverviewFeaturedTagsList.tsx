import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {space} from 'sentry/styles/space';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {useSlowestTagValuesQuery} from 'sentry/views/performance/browser/webVitals/utils/useSlowestTagValuesQuery';

type Props = {
  tag: string;
  transaction: string;
  title?: string;
};

const LIMIT = 4;

export function PageOverviewFeaturedTagsList({transaction, tag, title}: Props) {
  const {data} = useSlowestTagValuesQuery({transaction, tag, limit: LIMIT});
  const tagValues = data?.data ?? [];
  return (
    <Container>
      <Title>{title ?? tag}</Title>
      <TagValuesContainer>
        {tagValues.map((row, index) => {
          const score = calculatePerformanceScore({
            lcp: row['p75(measurements.lcp)'] as number,
            fcp: row['p75(measurements.fcp)'] as number,
            cls: row['p75(measurements.cls)'] as number,
            ttfb: row['p75(measurements.ttfb)'] as number,
            fid: row['p75(measurements.fid)'] as number,
          });
          return (
            <RowContainer key={`${tag}:${index}`}>
              <TagValue>
                <TagButton
                  priority="link"
                  onClick={() => {
                    // TODO: need to pass in handler here to open detail panel
                  }}
                >
                  {row[tag]}
                </TagButton>
              </TagValue>
              <Score>{score.totalScore}</Score>
            </RowContainer>
          );
        })}
      </TagValuesContainer>
    </Container>
  );
}

const Container = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
`;

const Title = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
  display: block;
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${space(1)};
  padding-left: ${space(0.75)};
`;

const TagValuesContainer = styled('div')`
  > div:nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const RowContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 32px;
  height: 32px;
`;

const TagValue = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  padding: ${space(0.75)};
`;

const Score = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  padding: ${space(0.75)};
  text-align: right;
`;

const TagButton = styled(Button)`
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  > span {
    display: inline;
  }
`;
