import styled from '@emotion/styled';

import {IconFile} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import {useResourcesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {SpanMetricsField} from 'sentry/views/starfish/types';

export function Recommendations({
  transaction,
  webVital,
}: {
  transaction: string;
  webVital: WebVitals;
}) {
  switch (webVital) {
    case 'lcp':
      return null;
    case 'fid':
      return null;
    case 'cls':
      return null;
    case 'fcp':
      return <FcpRecommendations transaction={transaction} />;
    case 'ttfb':
      return null;
    default:
      return null;
  }
}

function FcpRecommendations({transaction}: {transaction: string}) {
  const query = `transaction:"${transaction}" resource.render_blocking_status:blocking`;
  const {data, isLoading} = useResourcesQuery({
    query,
    sort: {field: `avg(${SpanMetricsField.SPAN_SELF_TIME})`, kind: 'desc'},
    defaultResourceTypes: ['resource.script', 'resource.css', 'resource.img'],
    limit: 7,
  });
  if (isLoading || !data) {
    return null;
  }
  return (
    <RecommendationsContainer>
      <RecommendationsHeader />
      <ul>
        <RecommendationSubHeader>
          {t('Eliminate render blocking resources')}
        </RecommendationSubHeader>
        <ResourceList>
          {data.map(
            ({
              'span.op': op,
              'span.description': description,
              'avg(span.self_time)': duration,
            }) => {
              return (
                <ResourceListItem key={description}>
                  <Flex>
                    <span>
                      <ResourceType resourceType={op} />
                      <ResourceDescription>
                        {formatDescription(description)}
                      </ResourceDescription>
                    </span>
                    <span>{getFormattedDuration(duration)}</span>
                  </Flex>
                </ResourceListItem>
              );
            }
          )}
        </ResourceList>
      </ul>
    </RecommendationsContainer>
  );
}

function RecommendationsHeader() {
  return (
    <RecommendationsHeaderContainer>
      <b>{t('Recommendations')}</b>
    </RecommendationsHeaderContainer>
  );
}

function ResourceType({resourceType}: {resourceType: `resource.${string}`}) {
  switch (resourceType) {
    case 'resource.script':
      return (
        <b>
          <StyledIconFile size="xs" />
          {t('js')}
          {' \u2014 '}
        </b>
      );
    case 'resource.css':
      return (
        <b>
          <StyledIconFile size="xs" />
          {t('css')}
          {' \u2014 '}
        </b>
      );
    case 'resource.img':
      return (
        <b>
          <StyledIconFile size="xs" />
          {t('img')}
          {' \u2014 '}
        </b>
      );
    default:
      return null;
  }
}

function formatDescription(description: string) {
  // Center truncate the description
  if (description.length > 50) {
    return `${description.slice(0, 25)}...${description.slice(description.length - 25)}`;
  }
  return description;
}

const getFormattedDuration = (value: number | null) => {
  if (value === null) {
    return null;
  }
  if (value < 1000) {
    return getDuration(value / 1000, 0, true);
  }
  return getDuration(value / 1000, 2, true);
};

const StyledIconFile = styled(IconFile)`
  margin-right: ${space(0.5)};
`;

const RecommendationSubHeader = styled('li')`
  margin-bottom: ${space(1)};
`;

const ResourceListItem = styled('li')`
  margin-bottom: ${space(1)};
  list-style: none;
  white-space: nowrap;
`;

const RecommendationsHeaderContainer = styled('div')`
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const ResourceList = styled('ul')`
  padding-left: ${space(1)};
`;

const ResourceDescription = styled('span')``;

const Flex = styled('span')`
  display: flex;
  justify-content: space-between;
`;

const RecommendationsContainer = styled('div')`
  margin-bottom: ${space(4)};
`;
