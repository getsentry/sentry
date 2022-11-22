import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import Button from 'sentry/components/button';
import {deviceNameMapper} from 'sentry/components/deviceName';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {TagWithTopValues} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import TagFacetsDistributionMeter from './tagFacetsDistributionMeter';
import {TagFacetsProps} from './tagFacetsTypes';

type State = {
  loading: boolean;
  selectedTag: string;
  showMore: boolean;
  tagsData: Record<string, TagWithTopValues>;
};

export default function TagFacetsDistributions({
  tagKeys,
  environments,
  group,
  title,
}: TagFacetsProps) {
  const [state, setState] = useState<State>({
    tagsData: {},
    selectedTag: tagKeys.length > 0 ? tagKeys[0] : '',
    loading: true,
    showMore: false,
  });
  const organization = useOrganization();
  const api = useApi();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${group.id}/tags/`, {
        query: {
          key: tagKeys,
          environment: environments.map(env => env.name),
          readable: true,
        },
      });
      const tagsData = keyBy(data, 'key');
      const defaultSelectedTag = tagKeys.find(tagKey =>
        Object.keys(tagsData).includes(tagKey)
      );
      setState({
        ...state,
        tagsData,
        loading: false,
        selectedTag: defaultSelectedTag ?? state.selectedTag,
      });
    };
    setState({...state, loading: true});
    fetchData().catch(() => {
      setState({...state, tagsData: {}, loading: false});
    });
    // Don't want to requery everytime state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, JSON.stringify(environments), group.id, tagKeys]);

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{title || t('Most Impacted Tags')}</SidebarSection.Title>
      <Content>
        {!state.tagsData ? (
          <TagPlaceholders>
            <Placeholder height="40px" />
            <Placeholder height="40px" />
            <Placeholder height="40px" />
            <Placeholder height="40px" />
          </TagPlaceholders>
        ) : (
          <React.Fragment>
            {Object.keys(state.tagsData).map(tagKey => {
              const tagWithTopValues = state.tagsData[tagKey];
              const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
              const topValuesTotal = tagWithTopValues ? tagWithTopValues.totalValues : 0;

              const url = `/organizations/${organization.slug}/issues/${group.id}/tags/${tagKey}/?referrer=tag-distribution-meter`;

              const segments = topValues
                ? topValues.map(value => ({
                    ...value,
                    name: deviceNameMapper(value.name || '') || value.name,
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
                />
              );
            })}
            <ShowAllButtonContainer>
              <Button size="xs" to={getTagUrl(organization.slug, group.id)}>
                {t('View All Tags')}
              </Button>
            </ShowAllButtonContainer>
          </React.Fragment>
        )}
        {group.tags.length === 0 && (
          <p data-test-id="no-tags">
            {environments.length
              ? t('No tags found in the selected environments')
              : t('No tags found')}
          </p>
        )}
      </Content>
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
