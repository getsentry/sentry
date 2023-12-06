import {useRef} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/actionCreators/events';
import {GroupTagsResponse, useFetchIssueTags} from 'sentry/actionCreators/group';
import {Alert} from 'sentry/components/alert';
import Count from 'sentry/components/count';
import {DeviceName} from 'sentry/components/deviceName';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {sumTagFacetsForTopValues} from 'sentry/components/group/tagFacets';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, IssueType} from 'sentry/types';
import {defined, percent} from 'sentry/utils';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {generateTagsRoute} from '../performance/transactionSummary/transactionTags/utils';

type GroupTagsProps = {
  baseUrl: string;
  environments: string[];
  group: Group;
  event?: Event;
};

type SimpleTag = {
  key: string;
  topValues: Array<{
    count: number;
    name: string;
    value: string;
    query?: string;
  }>;
  totalValues: number;
};

function isTagFacetsResponse(
  _: GroupTagsResponse | Tag[] | undefined,
  shouldUseTagFacetsEndpoint: boolean
): _ is Tag[] {
  return shouldUseTagFacetsEndpoint;
}

function GroupTags({group, baseUrl, environments, event}: GroupTagsProps) {
  const organization = useOrganization();
  const location = useLocation();
  const now = useRef(Date.now()).current;

  const {transaction, aggregateRange2, breakpoint} =
    event?.occurrence?.evidenceData ?? {};

  const {start: beforeDateTime, end: afterDateTime} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 14,
  });

  const isRegressionIssue =
    group.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION ||
    group.issueType === IssueType.PERFORMANCE_ENDPOINT_REGRESSION;

  const shouldUseTagFacetsEndpoint =
    organization.features.includes('performance-duration-regression-visible') &&
    defined(event) &&
    isRegressionIssue;

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useFetchIssueTags({
    orgSlug: organization.slug,
    groupId: group.id,
    environment: environments,
    isStatisticalDetector: shouldUseTagFacetsEndpoint,
    statisticalDetectorParameters: shouldUseTagFacetsEndpoint
      ? {
          transaction,
          start: new Date(breakpoint * 1000).toISOString(),
          end: new Date(now).toISOString(),
          durationBaseline: aggregateRange2,
        }
      : undefined,
  });

  // useFetchIssueTags can return two different types of responses, depending on shouldUseTagFacetsEndpoint
  // This line will convert the response to a common type for rendering
  const tagList: SimpleTag[] = isTagFacetsResponse(data, shouldUseTagFacetsEndpoint)
    ? data.filter(({key}) => key !== 'transaction')?.map(sumTagFacetsForTopValues)
    : data;
  const alphabeticalTags = tagList.sort((a, b) => a.key.localeCompare(b.key));

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('There was an error loading issue tags.')}
        onRetry={refetch}
      />
    );
  }

  const getTagKeyTarget = (tag: SimpleTag) => {
    const pathname = isRegressionIssue
      ? generateTagsRoute({orgSlug: organization.slug})
      : `${baseUrl}tags/${tag.key}/`;

    const query = isRegressionIssue
      ? {
          ...extractSelectionParameters(location.query),
          start: (beforeDateTime as Date).toISOString(),
          end: (afterDateTime as Date).toISOString(),
          statsPeriod: undefined,
          tagKey: tag.key,
          transaction,
        }
      : extractSelectionParameters(location.query);

    return {
      pathname,
      query,
    };
  };

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Alert type="info">
          {tct(
            'Tags are automatically indexed for searching and breakdown charts. Learn how to [link: add custom tags to issues]',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags" />
              ),
            }
          )}
        </Alert>
        <Container>
          {alphabeticalTags.map((tag, tagIdx) => (
            <TagItem key={tagIdx}>
              <StyledPanel>
                <PanelBody withPadding>
                  <TagHeading>
                    <Link to={getTagKeyTarget(tag)}>
                      <span data-test-id="tag-title">{tag.key}</span>
                    </Link>
                  </TagHeading>
                  <UnstyledUnorderedList>
                    {tag.topValues.map((tagValue, tagValueIdx) => (
                      <li key={tagValueIdx} data-test-id={tag.key}>
                        <TagBarGlobalSelectionLink
                          to={{
                            pathname: `${baseUrl}events/`,
                            query: {
                              query: tagValue.query || `${tag.key}:"${tagValue.value}"`,
                            },
                          }}
                        >
                          <TagBarBackground
                            widthPercent={percent(tagValue.count, tag.totalValues) + '%'}
                          />
                          <TagBarLabel>
                            {tag.key === 'release' ? (
                              <Version version={tagValue.name} anchor={false} />
                            ) : (
                              <DeviceName value={tagValue.name} />
                            )}
                          </TagBarLabel>
                          <TagBarCount>
                            <Count value={tagValue.count} />
                          </TagBarCount>
                        </TagBarGlobalSelectionLink>
                      </li>
                    ))}
                  </UnstyledUnorderedList>
                </PanelBody>
              </StyledPanel>
            </TagItem>
          ))}
        </Container>
      </Layout.Main>
    </Layout.Body>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  height: 100%;
`;

const TagHeading = styled('h5')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: 0;
  color: ${p => p.theme.linkColor};
`;

const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0;
`;

const TagItem = styled('div')`
  padding: 0;
`;

const TagBarBackground = styled('div')<{widthPercent: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.tagBar};
  border-radius: ${p => p.theme.borderRadius};
  width: ${p => p.widthPercent};
`;

const TagBarGlobalSelectionLink = styled(GlobalSelectionLink)`
  position: relative;
  display: flex;
  line-height: 2.2;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
    ${TagBarBackground} {
      background: ${p => p.theme.tagBarHover};
    }
  }
`;

const TagBarLabel = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis}
`;

const TagBarCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding-left: ${space(2)};
  padding-right: ${space(1)};
  font-variant-numeric: tabular-nums;
`;

export default GroupTags;
