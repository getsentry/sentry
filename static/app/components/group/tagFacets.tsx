import {Fragment, ReactNode, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Environment, TagWithTopValues} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import Button from '../button';
import ButtonBar from '../buttonBar';
import BreakdownBars from '../charts/breakdownBars';

export const MOBILE_TAGS = ['os', 'device', 'release'];

const LESS_ITEMS = 4;
const MORE_ITEMS = 8;

type Props = {
  environments: Environment[];
  groupId: string;
  tagKeys: string[];
  title?: ReactNode;
};

type State = {
  loading: boolean;
  selectedTag: string;
  showMore: boolean;
  tagsData: Record<string, TagWithTopValues>;
};

export function TagFacets({groupId, tagKeys, environments, title}: Props) {
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
  }, [api, environments, groupId, tagKeys]);

  const availableTagKeys = tagKeys.filter(tagKey => !!state.tagsData[tagKey]);
  const points =
    state.tagsData[state.selectedTag]?.topValues.map(({name, count}) => {
      return {label: name, value: count};
    }) ?? [];

  if (state.loading) {
    return <Placeholder height="60px" />;
  }
  if (availableTagKeys.length > 0) {
    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{title ?? t('Tag Summary')}</SidebarSection.Title>
        <TagFacetsContainer>
          <ButtonBar merged active={state.selectedTag}>
            {availableTagKeys.map(tagKey => {
              return (
                <Button
                  size="xs"
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
          </ButtonBar>
          <BreakdownBarsContainer>
            <BreakdownBars
              data={points}
              maxItems={state.showMore ? MORE_ITEMS : LESS_ITEMS}
            />
          </BreakdownBarsContainer>
          <ButtonContainer>
            {points.length > LESS_ITEMS && (
              <Fragment>
                {state.showMore && (
                  <Button
                    size="xs"
                    to={getTagUrl(organization.slug, groupId, state.selectedTag)}
                  >
                    {t('View all')}
                  </Button>
                )}
                <Button
                  size="xs"
                  onClick={() => setState({...state, showMore: !state.showMore})}
                >
                  {state.showMore ? t('Show less') : t('Show more')}
                </Button>
              </Fragment>
            )}
          </ButtonContainer>
        </TagFacetsContainer>
      </SidebarSection.Wrap>
    );
  }
  return null;
}

function getTagUrl(orgSlug: string, groupId: string, tag: string) {
  return `/organizations/${orgSlug}/issues/${groupId}/tags/${tag}/`;
}

const TagFacetsContainer = styled('div')`
  margin-top: ${space(2)};
`;

const BreakdownBarsContainer = styled('div')`
  margin-top: ${space(2)};
  overflow: hidden;
`;

const ButtonContainer = styled('div')`
  margin-top: ${space(1)};
  display: flex;
  column-gap: ${space(0.5)};
  justify-content: flex-end;
`;
