import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import Button from 'sentry/components/button';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {TagWithTopValues} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {isMobilePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import TagFacetsDistributionMeter from './tagFacetsDistributionMeter';
import {TagFacetsProps} from './tagFacetsTypes';

type State = {
  loading: boolean;
  tagsData: Record<string, TagWithTopValues>;
};

const LIMIT = 4;

export default function TagFacetsDistributions({
  tagKeys,
  environments,
  groupId,
  title,
  tagFormatter,
  project,
}: TagFacetsProps) {
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
          key: tagKeys,
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
  const sortedTagKeys = Object.keys(tagsData).sort();

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
        <React.Fragment>
          <SidebarSection.Title>{title || t('Most Impacted Tags')}</SidebarSection.Title>
          <Content>
            <React.Fragment>
              {sortedTagKeys.map(tagKey => {
                const tagWithTopValues = tagsData[tagKey];
                const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
                const topValuesTotal = tagWithTopValues
                  ? tagWithTopValues.totalValues
                  : 0;

                const url = `/organizations/${organization.slug}/issues/${groupId}/tags/${tagKey}/?referrer=tag-distribution-meter`;

                const segments = topValues
                  ? topValues.map(value => ({
                      ...value,
                      url,
                    }))
                  : [];

                return (
                  <TagFacetsDistributionMeter
                    key={tagKey}
                    title={tagKey}
                    totalValues={topValuesTotal}
                    segments={segments}
                    onTagClick={() => undefined}
                    project={project}
                  />
                );
              })}
              <ShowAllButtonContainer>
                <Button
                  size="xs"
                  to={getTagUrl(organization.slug, groupId)}
                  onClick={() => {
                    trackAdvancedAnalyticsEvent(
                      'issue_group_details.tags.show_all_tags.clicked',
                      {
                        platform: project?.platform,
                        is_mobile: isMobilePlatform(project?.platform),
                        organization,
                        type: 'distributions',
                      }
                    );
                  }}
                >
                  {t('View All Tags')}
                </Button>
              </ShowAllButtonContainer>
            </React.Fragment>
          </Content>
        </React.Fragment>
      )}
    </SidebarSection.Wrap>
  );
}

function getTagUrl(orgSlug: string, groupId: string) {
  return `/organizations/${orgSlug}/issues/${groupId}/tags/`;
}

const TagPlaceholders = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
`;

const ShowAllButtonContainer = styled('div')`
  margin-top: ${space(3)};
`;

const Content = styled('div')`
  margin-top: ${space(2)};
`;
