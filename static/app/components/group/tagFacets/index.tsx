import type {ReactNode} from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';
import keyBy from 'lodash/keyBy';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {appendTagCondition} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  type GroupTag,
  useGroupTagsReadable,
} from 'sentry/views/issueDetails/groupTags/useGroupTags';

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

export function TAGS_FORMATTER(tagsData: Record<string, GroupTag>) {
  // For "release" tag keys, format the release tag value to be more readable (ie removing version prefix)
  const transformedTagsData: Record<string, GroupTag> = {};
  Object.keys(tagsData).forEach(tagKey => {
    if (tagKey === 'release') {
      transformedTagsData[tagKey] = {
        ...tagsData[tagKey]!,
        topValues: tagsData[tagKey]!.topValues.map(topValue => {
          return {
            ...topValue,
            name: formatVersion(topValue.name),
          };
        }),
      };
    } else if (tagKey === 'device') {
      transformedTagsData[tagKey] = {
        ...tagsData[tagKey]!,
        topValues: tagsData[tagKey]!.topValues.map(topValue => {
          return {
            ...topValue,
            name: topValue.readable ?? topValue.name,
          };
        }),
      };
    } else {
      transformedTagsData[tagKey] = tagsData[tagKey]!;
    }
  });

  return transformedTagsData;
}

type Props = {
  environments: string[];
  groupId: string;
  project: Project;
  tagKeys: string[];
  tagFormatter?: (tagsData: Record<string, GroupTag>) => Record<string, GroupTag>;
};

export default function TagFacets({
  tagKeys,
  environments,
  groupId,
  tagFormatter,
  project,
}: Props) {
  const organization = useOrganization();

  const {isPending, isError, data, refetch} = useGroupTagsReadable({
    groupId,
    environment: environments,
    limit: 4,
  });

  const tagsData = useMemo((): Record<string, GroupTag> => {
    if (!data) {
      return {};
    }

    const keyed = keyBy(data, 'key');
    const formatted = tagFormatter?.(keyed) ?? keyed;

    return formatted;
  }, [data, tagFormatter]);

  // filter out replayId since we no longer want to
  // display this on issue details
  const topTagKeys = tagKeys.filter(
    tagKey => Object.keys(tagsData).includes(tagKey) && tagKey !== 'replayId'
  );
  const remainingTagKeys = Object.keys(tagsData)
    .filter(tagKey => !tagKeys.includes(tagKey) && tagKey !== 'replayId')
    .sort();

  if (isPending) {
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
        <GuideAnchor target="issue_sidebar_tags" position="left">
          {t('All Tags')}
        </GuideAnchor>
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
  tagsData: Record<string, GroupTag>;
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
