import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project, TagWithTopValues} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {formatPercentage} from 'sentry/utils/formatters';
import {isMobilePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import {TagFacetsProps} from './tagFacetsTypes';

type State = {
  loading: boolean;
  selectedTag: string;
  showMore: boolean;
  tagsData: Record<string, TagWithTopValues>;
};

const MAX_ITEMS = 5;

export default function TagFacetsBars({
  groupId,
  tagKeys,
  environments,
  event,
  tagFormatter,
  title,
  project,
}: TagFacetsProps) {
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
        label: name,
        value: count,
        url,
        active: isTagValueOfCurrentEvent,
        tooltip: isTagValueOfCurrentEvent
          ? t('The tag value of the current event.')
          : undefined,
      };
    }) ?? [];

  if (state.loading) {
    return <Placeholder height="60px" />;
  }
  if (availableTagKeys.length > 0) {
    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{title ?? t('Tag Summary')}</SidebarSection.Title>
        <TagFacetsContainer>
          <StyledButtonBar merged active={state.selectedTag}>
            {availableTagKeys.map(tagKey => {
              return (
                <Button
                  size="xs"
                  key={tagKey}
                  barId={tagKey}
                  onClick={() => {
                    trackAdvancedAnalyticsEvent(
                      'issue_group_details.tags.switcher.clicked',
                      {
                        tag: tagKey,
                        previous_tag: state.selectedTag,
                        platform: project?.platform,
                        is_mobile: isMobilePlatform(project?.platform),
                        organization,
                      }
                    );
                    setState({...state, selectedTag: tagKey, showMore: false});
                  }}
                >
                  {tagKey}
                </Button>
              );
            })}
          </StyledButtonBar>
          <BreakdownBars
            tag={state.selectedTag}
            data={points}
            maxItems={MAX_ITEMS}
            project={project}
          />
          <Button
            size="xs"
            to={getTagUrl(organization.slug, groupId)}
            onClick={() => {
              trackAdvancedAnalyticsEvent(
                'issue_group_details.tags.show_all_tags.clicked',
                {
                  tag: state.selectedTag,
                  platform: project?.platform,
                  is_mobile: isMobilePlatform(project?.platform),
                  organization,
                }
              );
            }}
          >
            {t('Show All Tags')}
          </Button>
        </TagFacetsContainer>
      </SidebarSection.Wrap>
    );
  }
  return null;
}

function getTagUrl(orgSlug: string, groupId: string) {
  return `/organizations/${orgSlug}/issues/${groupId}/tags/`;
}

type Point = {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  tooltip?: string;
  url?: string;
};

type Props = {
  /**
   * The data to display. The caller should order the points
   * in the order they want bars displayed.
   */
  data: Point[];
  maxItems?: number;
  project?: Project;
  tag?: string;
};

function BreakdownBars({data, maxItems, project, tag}: Props) {
  const organization = useOrganization();
  const total = data.reduce((sum, point) => point.value + sum, 0);
  return (
    <BreakdownGrid>
      {(maxItems ? data.slice(0, maxItems) : data).map((point, i) => {
        let bar = (
          <Fragment>
            <Bar
              style={{width: `${((point.value / total) * 100).toFixed(2)}%`}}
              active={point.active}
            />
            <Label>
              {point.label}
              <Percentage>{formatPercentage(point.value / total, 0)}</Percentage>
            </Label>
          </Fragment>
        );
        if (point.url) {
          bar = (
            <Link
              to={point.url}
              aria-label={t('Add %s to the search query', point.label)}
              onClick={() => {
                if (tag && project) {
                  trackAdvancedAnalyticsEvent('issue_group_details.tags.bar.clicked', {
                    tag,
                    value: point.label,
                    platform: project.platform,
                    is_mobile: isMobilePlatform(project?.platform),
                    organization,
                  });
                }
              }}
            >
              {bar}
            </Link>
          );
        }
        return (
          <Fragment key={`${i}:${point.label}`}>
            <BarContainer
              data-test-id={`status-${point.label}`}
              cursor={point.onClick ? 'pointer' : 'default'}
              onClick={point.onClick}
            >
              {point.tooltip ? <Tooltip title={point.tooltip}>{bar}</Tooltip> : bar}
            </BarContainer>
          </Fragment>
        );
      })}
    </BreakdownGrid>
  );
}

const BreakdownGrid = styled('div')`
  display: grid;
  row-gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const BarContainer = styled('div')<{cursor: 'pointer' | 'default'}>`
  padding-left: ${space(0.5)};
  padding-right: ${space(0.5)};
  position: relative;
  cursor: ${p => p.cursor};
  display: flex;
  align-items: center;
`;

const Label = styled('span')`
  position: relative;
  color: ${p => p.theme.textColor};
  z-index: 2;
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(0.25)} 0;
`;

const Percentage = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;

const Bar = styled('div')<{active?: boolean}>`
  background-color: ${p => (p.active ? p.theme.purple200 : p.theme.gray100)};
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  height: 100%;
  width: 0%;
`;

const TagFacetsContainer = styled('div')`
  margin-top: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  display: flex;
  margin-bottom: ${space(1)};
`;
