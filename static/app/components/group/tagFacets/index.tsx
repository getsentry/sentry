import {Fragment, ReactNode, useMemo} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import keyBy from 'lodash/keyBy';

import {Tag} from 'sentry/actionCreators/events';
import {GroupTagResponseItem} from 'sentry/actionCreators/group';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatVersion} from 'sentry/utils/formatters';
import {appendTagCondition} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useFetchIssueTagsForDetailsPage} from 'sentry/views/issueDetails/utils';

import TagFacetsDistributionMeter from './tagFacetsDistributionMeter';

export const MOBILE_TAGS = [
  'device',
  'device.class',
  'os',
  'release',
  'environment',
  'transaction',
];

export const FRONTEND_TAGS = ['browser', 'transaction', 'release', 'url', 'environment'];

export const BACKEND_TAGS = [
  'transaction',
  'url',
  'user',
  'release',
  'organization.slug',
];

export const DEFAULT_TAGS = ['transaction', 'environment', 'release'];

export function TAGS_FORMATTER(tagsData: Record<string, GroupTagResponseItem>) {
  // For "release" tag keys, format the release tag value to be more readable (ie removing version prefix)
  const transformedTagsData = {};
  Object.keys(tagsData).forEach(tagKey => {
    if (tagKey === 'release') {
      transformedTagsData[tagKey] = {
        ...tagsData[tagKey],
        topValues: tagsData[tagKey].topValues.map(topValue => {
          return {
            ...topValue,
            name: formatVersion(topValue.name),
          };
        }),
      };
    } else if (tagKey === 'device') {
      transformedTagsData[tagKey] = {
        ...tagsData[tagKey],
        topValues: tagsData[tagKey].topValues.map(topValue => {
          return {
            ...topValue,
            name: topValue.readable ?? topValue.name,
          };
        }),
      };
    } else {
      transformedTagsData[tagKey] = tagsData[tagKey];
    }
  });

  return transformedTagsData;
}

export function sumTagFacetsForTopValues(tag: Tag) {
  return {
    ...tag,
    name: tag.key,
    totalValues: tag.topValues.reduce((acc, {count}) => acc + count, 0),
    topValues: tag.topValues.map(({name, count}) => ({
      key: tag.key,
      name,
      value: name,
      count,

      // These values aren't displayed in the sidebar
      firstSeen: '',
      lastSeen: '',
    })),
  };
}

// Statistical detector issues need to use a Discover query
// which means we need to massage the values to fit the component API
function transformTagFacetDataToGroupTagResponseItems(
  tagFacetData: Record<string, Tag>
): Record<string, GroupTagResponseItem> {
  const keyedResponse = {};

  // Statistical detectors are scoped to a single transaction so
  // the filter out transaction since the tag is not helpful in the UI
  Object.keys(tagFacetData)
    .filter(tagKey => tagKey !== 'transaction')
    .forEach(tagKey => {
      const tagData = tagFacetData[tagKey];
      keyedResponse[tagKey] = sumTagFacetsForTopValues(tagData);
    });

  return keyedResponse;
}

type Props = {
  environments: string[];
  groupId: string;
  project: Project;
  tagKeys: string[];
  event?: Event;
  isStatisticalDetector?: boolean;
  tagFormatter?: (
    tagsData: Record<string, GroupTagResponseItem>
  ) => Record<string, GroupTagResponseItem>;
};

export default function TagFacets({
  tagKeys,
  environments,
  groupId,
  tagFormatter,
  project,
  isStatisticalDetector,
  event,
}: Props) {
  const organization = useOrganization();
  const now = useMemo(() => Date.now(), []);

  const {transaction, aggregateRange2, breakpoint} =
    event?.occurrence?.evidenceData ?? {};
  const {isLoading, isError, data, refetch} = useFetchIssueTagsForDetailsPage({
    groupId,
    orgSlug: organization.slug,
    environment: environments,
    isStatisticalDetector,
    statisticalDetectorParameters:
      isStatisticalDetector && defined(breakpoint)
        ? {
            transaction,
            durationBaseline: aggregateRange2,
            start: new Date(breakpoint * 1000).toISOString(),
            end: new Date(now).toISOString(),
          }
        : undefined,
  });

  const tagsData = useMemo(() => {
    if (!data) {
      return {};
    }

    let keyed = keyBy(data, 'key');
    if (isStatisticalDetector) {
      keyed = transformTagFacetDataToGroupTagResponseItems(keyed as Record<string, Tag>);
    }

    const formatted =
      tagFormatter?.(keyed as Record<string, GroupTagResponseItem>) ?? keyed;

    if (!organization.features.includes('device-classification')) {
      delete formatted['device.class'];
    }

    return formatted as Record<string, GroupTagResponseItem>;
  }, [data, tagFormatter, organization, isStatisticalDetector]);

  const topTagKeys = tagKeys.filter(tagKey => Object.keys(tagsData).includes(tagKey));
  const remainingTagKeys = Object.keys(tagsData)
    .filter(tagKey => !tagKeys.includes(tagKey))
    .sort();

  if (isLoading) {
    return (
      <WrapperWithTitle>
        <TagPlaceholders>
          <Placeholder height="40px" />
          <Placeholder height="40px" />
          <Placeholder height="40px" />
          <Placeholder height="40px" />
        </TagPlaceholders>
      </WrapperWithTitle>
    );
  }

  if (isError) {
    return (
      <WrapperWithTitle>
        <LoadingError
          message={t('There was an error loading tags for this issue.')}
          onRetry={refetch}
        />
      </WrapperWithTitle>
    );
  }

  return (
    <WrapperWithTitle>
      <Fragment>
        {Object.keys(tagsData).length === 0 ? (
          <NoTagsFoundContainer data-test-id="no-tags">
            {environments.length
              ? t('No tags found in the selected environments')
              : t('No tags found')}
          </NoTagsFoundContainer>
        ) : (
          <Content>
            <span data-test-id="top-distribution-wrapper">
              <TagFacetsDistributionMeterWrapper
                groupId={groupId}
                organization={organization}
                project={project}
                tagKeys={topTagKeys}
                tagsData={tagsData}
                expandFirstTag
              />
            </span>
            <TagFacetsDistributionMeterWrapper
              groupId={groupId}
              organization={organization}
              project={project}
              tagKeys={remainingTagKeys}
              tagsData={tagsData}
            />
          </Content>
        )}
      </Fragment>
    </WrapperWithTitle>
  );
}

function WrapperWithTitle({children}: {children: ReactNode}) {
  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>
        {t('All Tags')}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t('The tags associated with all events in this issue')}
        />
      </SidebarSection.Title>
      {children}
    </SidebarSection.Wrap>
  );
}

function TagFacetsDistributionMeterWrapper({
  groupId,
  organization,
  project,
  tagKeys,
  tagsData,
  expandFirstTag,
}: {
  groupId: string;
  organization: Organization;
  project: Project;
  tagKeys: string[];
  tagsData: Record<string, GroupTagResponseItem>;
  expandFirstTag?: boolean;
}) {
  const location = useLocation();
  const query = {...location.query};
  return (
    <TagFacetsList>
      {tagKeys.map((tagKey, index) => {
        const tagWithTopValues = tagsData[tagKey];
        const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
        const topValuesTotal = tagWithTopValues ? tagWithTopValues.totalValues : 0;

        const otherTagValuesUrl = `/organizations/${organization.slug}/issues/${groupId}/tags/${tagKey}/?referrer=tag-distribution-meter`;
        const eventsPath = `/organizations/${organization.slug}/issues/${groupId}/events/`;

        const segments = topValues
          ? topValues.map(value => {
              // Create a link to the events page with a tag condition on the selected value
              const url: LocationDescriptor = {
                ...location,
                query: {
                  ...query,
                  query: appendTagCondition(null, tagKey, value.value),
                },
                pathname: eventsPath,
              };

              return {
                ...value,
                url,
              };
            })
          : [];

        return (
          <li key={tagKey} aria-label={tagKey}>
            <TagFacetsDistributionMeter
              title={tagKey}
              totalValues={topValuesTotal}
              segments={segments}
              onTagClick={() => undefined}
              project={project}
              expandByDefault={expandFirstTag && index === 0}
              otherUrl={otherTagValuesUrl}
            />
          </li>
        );
      })}
    </TagFacetsList>
  );
}

const TagPlaceholders = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
  margin-top: ${space(1)};
`;

const Content = styled('div')`
  margin-top: ${space(2)};
`;

const NoTagsFoundContainer = styled('p')`
  margin-top: ${space(0.5)};
`;

export const TagFacetsList = styled('ol')`
  list-style: none;
  padding: 0;
  margin: 0 0 ${space(2)};
`;
