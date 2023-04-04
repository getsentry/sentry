import {Fragment, ReactNode, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import keyBy from 'lodash/keyBy';

import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Environment, Event, Organization, Project, TagWithTopValues} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import {appendTagCondition} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

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

export function TAGS_FORMATTER(tagsData: Record<string, TagWithTopValues>) {
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

type Props = {
  environments: Environment[];
  groupId: string;
  project: Project;
  tagKeys: string[];
  event?: Event;
  tagFormatter?: (
    tagsData: Record<string, TagWithTopValues>
  ) => Record<string, TagWithTopValues>;
  title?: ReactNode;
};

type State = {
  loading: boolean;
  tagsData: Record<string, TagWithTopValues>;
};

const LIMIT = 4;

export default function TagFacets({
  tagKeys,
  environments,
  groupId,
  title,
  tagFormatter,
  project,
}: Props) {
  const [state, setState] = useState<State>({
    tagsData: {},
    loading: true,
  });
  const organization = useOrganization();
  const api = useApi();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${groupId}/tags/`, {
        query: {
          environment: environments.map(env => env.name),
          readable: true,
          limit: LIMIT,
        },
      });
      const tagsData = keyBy(data, 'key');
      setState({
        ...state,
        tagsData,
        loading: false,
      });
    };
    setState({...state, loading: true});
    fetchData().catch(() => {
      setState({...state, tagsData: {}, loading: false});
    });
    // Don't want to requery everytime state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, JSON.stringify(environments), groupId, tagKeys]);

  const tagsData = tagFormatter?.(state.tagsData) ?? state.tagsData;
  if (!organization.features.includes('device-classification')) {
    delete tagsData['device.class'];
  }

  const topTagKeys = tagKeys.filter(tagKey => Object.keys(tagsData).includes(tagKey));
  const remainingTagKeys = Object.keys(tagsData)
    .filter(tagKey => !tagKeys.includes(tagKey))
    .sort();

  return (
    <SidebarSection.Wrap>
      {state.loading || !tagsData ? (
        <TagPlaceholders>
          <Placeholder height="40px" />
          <Placeholder height="40px" />
          <Placeholder height="40px" />
          <Placeholder height="40px" />
        </TagPlaceholders>
      ) : (
        <Fragment>
          <SidebarSection.Title>{title || t('All Tags')}</SidebarSection.Title>
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
      )}
    </SidebarSection.Wrap>
  );
}

const TagFacetsDistributionMeterWrapper = ({
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
  tagsData: Record<string, TagWithTopValues>;
  expandFirstTag?: boolean;
}) => {
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
};

const TagPlaceholders = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
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
