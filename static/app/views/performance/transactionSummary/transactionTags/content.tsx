import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import type {TableData} from 'sentry/utils/performance/segmentExplorer/segmentExplorerQuery';
import SegmentExplorerQuery from 'sentry/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

import {SpanOperationBreakdownFilter} from '../filter';
import {getTransactionField} from '../transactionOverview/tagExplorer';

import {X_AXIS_SELECT_OPTIONS} from './constants';
import TagsDisplay, {TAG_PAGE_TABLE_CURSOR} from './tagsDisplay';
import {decodeSelectedTagKey} from './utils';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
};

type TagOption = string;

function TagsPageContent(props: Props) {
  const {eventView, location, organization, projects} = props;

  const [aggregateColumn, setAggregateColumn] = useState(
    getTransactionField(SpanOperationBreakdownFilter.NONE, projects, eventView)
  );

  return (
    <Layout.Main fullWidth>
      <SegmentExplorerQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        limit={20}
        sort="-sumdelta"
        allTagKeys
      >
        {({isLoading, tableData}) => {
          return (
            <InnerContent
              {...props}
              isLoading={isLoading}
              tableData={tableData}
              aggregateColumn={aggregateColumn}
              onChangeAggregateColumn={setAggregateColumn}
            />
          );
        }}
      </SegmentExplorerQuery>
    </Layout.Main>
  );
}

function getTagKeyOptions(tableData: TableData) {
  const suspectTags: TagOption[] = [];
  const otherTags: TagOption[] = [];
  tableData.data.forEach(row => {
    const tagArray = row.comparison > 1 ? suspectTags : otherTags;
    tagArray.push(row.tags_key);
  });

  return {
    suspectTags,
    otherTags,
  };
}

function InnerContent(
  props: Props & {
    aggregateColumn: string;
    onChangeAggregateColumn: (aggregateColumn: string) => void;
    tableData: TableData | null;
    isLoading?: boolean;
  }
) {
  const {
    eventView: _eventView,
    location,
    organization,
    tableData,
    aggregateColumn,
    onChangeAggregateColumn,
    isLoading,
  } = props;
  const eventView = _eventView.clone();

  const tagOptions = tableData ? getTagKeyOptions(tableData) : null;
  const suspectTags = tagOptions ? tagOptions.suspectTags : [];
  const otherTags = tagOptions ? tagOptions.otherTags : [];

  const decodedTagKey = decodeSelectedTagKey(location);

  const allTags = [...suspectTags, ...otherTags];
  const decodedTagFromOptions = decodedTagKey
    ? allTags.find(tag => tag === decodedTagKey)
    : undefined;

  const defaultTag = allTags.length ? allTags[0] : undefined;

  const initialTag = decodedTagFromOptions ?? defaultTag;

  const navigate = useNavigate();
  const [tagSelected, _changeTagSelected] = useState(initialTag);
  const lastTag = useRef('');

  const changeTagSelected = useCallback(
    (tagKey: string) => {
      if (lastTag.current !== tagKey) {
        const queryParams = normalizeDateTimeParams({
          ...(location.query || {}),
          tagKey,
          [TAG_PAGE_TABLE_CURSOR]: undefined,
        });

        navigate(
          {
            pathname: location.pathname,
            query: queryParams,
          },
          {replace: true}
        );
        _changeTagSelected(tagKey);
        lastTag.current = decodeScalar(location.query.tagKey, '');
      }
    },
    [location.query, location.pathname, navigate]
  );

  useEffect(() => {
    if (initialTag) {
      changeTagSelected(initialTag);
    }
  }, [initialTag, changeTagSelected]);

  const handleSearch = (query: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    navigate({
      pathname: location.pathname,
      query: queryParams,
    });
  };

  const changeTag = (tag: string, isOtherTag: boolean) => {
    trackAnalytics('performance_views.tags.change_tag', {
      organization,
      from_tag: tagSelected!,
      to_tag: tag,
      is_other_tag: isOtherTag,
    });

    return changeTagSelected(tag);
  };
  if (tagSelected) {
    eventView.additionalConditions.setFilterValues('has', [tagSelected]);
  }

  const query = decodeScalar(location.query.query, '');

  const projectIds = useMemo(() => eventView.project?.slice(), [eventView.project]);

  return (
    <ReversedLayoutBody>
      <TagsSideBar
        suspectTags={suspectTags}
        otherTags={otherTags}
        tagSelected={tagSelected}
        changeTag={changeTag}
        isLoading={isLoading}
      />
      <StyledMain>
        <FilterActions>
          <PageFilterBar condensed>
            <EnvironmentPageFilter />
            <DatePageFilter />
          </PageFilterBar>
          <StyledSearchBarWrapper>
            <TransactionSearchQueryBuilder
              projects={projectIds}
              initialQuery={query}
              onSearch={handleSearch}
              searchSource="transaction_tags"
            />
          </StyledSearchBarWrapper>
          <CompactSelect
            value={aggregateColumn}
            options={X_AXIS_SELECT_OPTIONS}
            onChange={opt => {
              trackAnalytics('performance_views.tags.change_aggregate_column', {
                organization,
                value: opt.value,
              });
              onChangeAggregateColumn(opt.value);
            }}
            triggerProps={{prefix: t('X-Axis')}}
          />
        </FilterActions>
        <TagsDisplay {...props} tagKey={tagSelected} />
      </StyledMain>
    </ReversedLayoutBody>
  );
}

function TagsSideBar(props: {
  changeTag: (tag: string, isOtherTag: boolean) => void;
  otherTags: TagOption[];
  suspectTags: TagOption[];
  isLoading?: boolean;
  tagSelected?: string;
}) {
  const {suspectTags, otherTags, changeTag, tagSelected, isLoading} = props;
  return (
    <StyledSide>
      <StyledSectionHeading>
        {t('Suspect Tags')}
        <QuestionTooltip
          position="top"
          title={t('Suspect tags are tags that often correspond to slower transaction')}
          size="sm"
        />
      </StyledSectionHeading>
      {isLoading ? (
        <Placeholder height="200px" />
      ) : suspectTags.length ? (
        suspectTags.map(tag => (
          <RadioLabel key={tag}>
            <Radio
              aria-label={tag}
              checked={tagSelected === tag}
              onChange={() => changeTag(tag, false)}
            />
            <SidebarTagValue className="truncate">{tag}</SidebarTagValue>
          </RadioLabel>
        ))
      ) : (
        <div>{t('No tags detected.')}</div>
      )}

      <SidebarSpacer />
      <StyledSectionHeading>
        {t('Other Tags')}
        <QuestionTooltip
          position="top"
          title={t('Other common tags for this transaction')}
          size="sm"
        />
      </StyledSectionHeading>

      {isLoading ? (
        <Placeholder height="200px" />
      ) : otherTags.length ? (
        otherTags.map(tag => (
          <RadioLabel key={tag}>
            <Radio
              aria-label={tag}
              checked={tagSelected === tag}
              onChange={() => changeTag(tag, true)}
            />
            <SidebarTagValue className="truncate">{tag}</SidebarTagValue>
          </RadioLabel>
        ))
      ) : (
        <div>{t('No tags detected.')}</div>
      )}
    </StyledSide>
  );
}

const RadioLabel = styled('label')`
  cursor: pointer;
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightNormal};
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content 1fr;
  align-items: center;
  gap: ${space(1)};
`;

const SidebarTagValue = styled('span')`
  width: 100%;
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin-bottom: ${space(2)};
`;

// TODO(k-fish): Adjust thirds layout to allow for this instead.
const ReversedLayoutBody = styled('div')`
  margin: 0;
  background-color: ${p => p.theme.background};
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: grid;
    grid-template-columns: auto 66%;
    align-content: start;
    gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 225px minmax(100px, auto);
  }
`;

const StyledSide = styled('div')`
  grid-column: 1/2;
`;

const StyledMain = styled('div')`
  grid-column: 2/4;
  max-width: 100%;
`;

const StyledSearchBarWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/6;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 1fr auto;
  }
`;

export default TagsPageContent;
