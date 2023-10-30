import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {COUNTRY_CODE_TO_NAME_MAP} from 'sentry/data/countryCodesMap';
import {space} from 'sentry/styles/space';
import {Tag} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {useSlowestTagValuesQuery} from 'sentry/views/performance/browser/webVitals/utils/useSlowestTagValuesQuery';

type Props = {
  onClick: (tag: Tag) => void;
  tag: string;
  transaction: string;
  title?: string;
};

const LIMIT = 10;

function toReadableValue(tag, tagValue) {
  if (tag === 'geo.country_code') {
    return COUNTRY_CODE_TO_NAME_MAP[tagValue] ?? tagValue;
  }

  return tagValue;
}

function getPerformanceTotalScore(row: TableDataRow): number {
  const score = calculatePerformanceScore({
    lcp: row['p75(measurements.lcp)'] as number,
    fcp: row['p75(measurements.fcp)'] as number,
    cls: row['p75(measurements.cls)'] as number,
    ttfb: row['p75(measurements.ttfb)'] as number,
    fid: row['p75(measurements.fid)'] as number,
  });

  return score.totalScore;
}

export function PageOverviewFeaturedTagsList({transaction, tag, title, onClick}: Props) {
  const {data} = useSlowestTagValuesQuery({transaction, tag, limit: LIMIT});
  const tagValues = data?.data ?? [];

  // Sort the tag values in asc order of total performance score
  const sortedTagValues = tagValues.sort(
    (a, b) => getPerformanceTotalScore(a) - getPerformanceTotalScore(b)
  );

  return (
    <Container>
      <Title>{title ?? tag}</Title>
      <TagValuesContainer>
        {sortedTagValues.map((row, index) => {
          const score = getPerformanceTotalScore(row);
          return (
            <RowContainer key={`${tag}:${index}`}>
              <TagValue>
                <TagButton
                  priority="link"
                  onClick={() => onClick({key: tag, name: row[tag].toString()})}
                >
                  {toReadableValue(tag, row[tag])}
                </TagButton>
              </TagValue>
              <Score>
                <PerformanceBadge score={score} />
              </Score>
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
  grid-template-columns: 1fr auto;
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
