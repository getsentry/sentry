import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Environment, TagWithTopValues} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import Button from '../button';
import ButtonBar from '../buttonBar';
import BreakdownBars from '../charts/breakdownBars';

export const MOBILE_TAGS = ['os', 'device', 'release'];

type Props = {
  environments: Environment[];
  groupId: string;
  tagKeys: string[];
};

export function TagFacets({groupId, tagKeys, environments}: Props) {
  const [tagsData, setTagsData] = useState<Record<string, TagWithTopValues>>({});
  const [selectedTag, setSelectedTag] = useState<string>(
    tagKeys.length > 0 ? tagKeys[0] : ''
  );
  const [loading, setLoading] = useState<boolean>(true);
  const api = useApi();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${groupId}/tags/`, {
        query: {
          key: tagKeys,
          environment: environments.map(env => env.name),
        },
      });
      setTagsData(keyBy(data, 'key'));
      setLoading(false);
    };
    setLoading(true);
    fetchData().catch(() => {
      setTagsData({});
      setLoading(false);
    });
  }, [api, environments, groupId, tagKeys]);

  const availableTagKeys = tagKeys.filter(tagKey => !!tagsData[tagKey]);
  const points =
    tagsData[selectedTag]?.topValues.map(({name, count}) => {
      return {label: name, value: count};
    }) ?? [];

  if (loading) {
    return <Placeholder height="60px" />;
  }
  if (availableTagKeys.length > 0) {
    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('Tag Summary')}</SidebarSection.Title>
        <TagFacetsContainer>
          <ButtonBar merged active={selectedTag}>
            {availableTagKeys.map(tagKey => {
              return (
                <Button
                  size="xs"
                  key={tagKey}
                  barId={tagKey}
                  onClick={() => {
                    setSelectedTag(tagKey);
                  }}
                >
                  {tagKey}
                </Button>
              );
            })}
          </ButtonBar>
          <BreakdownBarsContainer>
            <BreakdownBars data={points} />
          </BreakdownBarsContainer>
        </TagFacetsContainer>
      </SidebarSection.Wrap>
    );
  }
  return null;
}

const TagFacetsContainer = styled('div')`
  margin-top: ${space(2)};
`;
const BreakdownBarsContainer = styled('div')`
  margin-top: ${space(2)};
  overflow: hidden;
`;
