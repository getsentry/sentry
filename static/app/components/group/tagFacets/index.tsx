import {ReactNode, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Environment, TagWithTopValues} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {formatVersion} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import TagBreakdown from './tagBreakdown';

export const MOBILE_TAGS = ['os', 'device', 'release'];
export function MOBILE_TAGS_FORMATTER(tagsData: Record<string, TagWithTopValues>) {
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
    } else {
      transformedTagsData[tagKey] = tagsData[tagKey];
    }
  });
  return transformedTagsData;
}

type Props = {
  environments: Environment[];
  groupId: string;
  tagKeys: string[];
  event?: Event;
  tagFormatter?: (
    tagsData: Record<string, TagWithTopValues>
  ) => Record<string, TagWithTopValues>;
  title?: ReactNode;
};

type State = {
  loading: boolean;
  selectedTag: string;
  showMore: boolean;
  tagsData: Record<string, TagWithTopValues>;
};

export function TagFacets({
  groupId,
  tagKeys,
  environments,
  event,
  tagFormatter,
  title,
}: Props) {
  const [state, setState] = useState<State>({
    tagsData: {},
    selectedTag: tagKeys.length > 0 ? tagKeys[0] : '',
    loading: true,
    showMore: false,
  });
  const api = useApi();
  const organization = useOrganization();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${groupId}/tags/`, {
        query: {
          key: tagKeys,
          environment: environments.map(env => env.name),
        },
      });
      setState({...state, tagsData: keyBy(data, 'key'), loading: false});
    };
    setState({...state, loading: true});
    fetchData().catch(() => {
      setState({...state, tagsData: {}, loading: false});
    });
    // Don't want to requery everytime state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, JSON.stringify(environments), groupId, tagKeys]);

  const availableTagKeys = tagKeys.filter(tagKey => !!state.tagsData[tagKey]);
  // Format tagsData if the component was given a tagFormatter
  const tagsData = tagFormatter?.(state.tagsData) ?? state.tagsData;
  const url = `/organizations/${organization.slug}/issues/${groupId}/tags/${state.selectedTag}/?referrer=tag-distribution-meter`;
  const points =
    tagsData[state.selectedTag]?.topValues.map(({name, value, count}) => {
      const isTagValueOfCurrentEvent =
        event?.tags.find(({key}) => key === state.selectedTag)?.value === value;
      return {
        name,
        value: name,
        count,
        url,
        active: isTagValueOfCurrentEvent,
        tooltip: isTagValueOfCurrentEvent
          ? t('This is also the tag value of the error event you are viewing.')
          : undefined,
      };
    }) ?? [];

  if (state.loading) {
    return <Placeholder height="60px" />;
  }
  if (availableTagKeys.length > 0) {
    return (
      <SidebarSection.Wrap>
        <Title>
          {title ?? t('Tag Summary')}
          <Button
            size="xs"
            to={`/organizations/${organization.slug}/issues/${groupId}/tags/`}
          >
            {t('View All')}
          </Button>
        </Title>
        <TagFacetsContainer>
          <StyledButtonBar merged active={state.selectedTag}>
            {availableTagKeys.map(tagKey => {
              return (
                <Button
                  size="sm"
                  key={tagKey}
                  barId={tagKey}
                  onClick={() => {
                    setState({...state, selectedTag: tagKey, showMore: false});
                  }}
                >
                  {tagKey}
                </Button>
              );
            })}
          </StyledButtonBar>
          <BreakdownContainer>
            <TagBreakdown points={points} maxItems={5} selectedTag={state.selectedTag} />
          </BreakdownContainer>
        </TagFacetsContainer>
      </SidebarSection.Wrap>
    );
  }
  return null;
}

const TagFacetsContainer = styled('div')`
  margin-top: ${space(2)};
`;

const BreakdownContainer = styled('div')`
  margin-top: ${space(2)};
  overflow: hidden;
`;

const StyledButtonBar = styled(ButtonBar)`
  display: flex;
`;

const Title = styled(SidebarSection.Title)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
`;
