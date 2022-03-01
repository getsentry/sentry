import {useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import SegmentExplorerQuery, {
  TableData,
} from 'sentry/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

import {SpanOperationBreakdownFilter} from '../filter';
import {getTransactionField} from '../transactionOverview/tagExplorer';

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

const TagsPageContent = (props: Props) => {
  const {eventView, location, organization, projects} = props;

  const aggregateColumn = getTransactionField(
    SpanOperationBreakdownFilter.None,
    projects,
    eventView
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
          return <InnerContent {...props} isLoading={isLoading} tableData={tableData} />;
        }}
      </SegmentExplorerQuery>
    </Layout.Main>
  );
};

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

const InnerContent = (
  props: Props & {tableData: TableData | null; isLoading?: boolean}
) => {
  const {eventView: _eventView, location, organization, tableData, isLoading} = props;
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

  const [tagSelected, _changeTagSelected] = useState(initialTag);

  const changeTagSelected = (tagKey: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      tagKey,
      [TAG_PAGE_TABLE_CURSOR]: undefined,
    });

    browserHistory.replace({
      pathname: location.pathname,
      query: queryParams,
    });
    _changeTagSelected(tagKey);
  };

  useEffect(() => {
    if (initialTag) {
      changeTagSelected(initialTag);
    }
  }, [initialTag]);

  const handleSearch = (query: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: queryParams,
    });
  };

  const changeTag = (tag: string) => {
    return changeTagSelected(tag);
  };
  if (tagSelected) {
    eventView.additionalConditions.setFilterValues('has', [tagSelected]);
  }

  const query = decodeScalar(location.query.query, '');

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
        <StyledActions>
          <StyledSearchBar
            organization={organization}
            projectIds={eventView.project}
            query={query}
            fields={eventView.fields}
            onSearch={handleSearch}
          />
        </StyledActions>
        <TagsDisplay {...props} tagKey={tagSelected} />
      </StyledMain>
    </ReversedLayoutBody>
  );
};

const TagsSideBar = (props: {
  changeTag: (tag: string) => void;
  otherTags: TagOption[];
  suspectTags: TagOption[];
  isLoading?: boolean;
  tagSelected?: string;
}) => {
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
        <Center>
          <LoadingIndicator mini />
        </Center>
      ) : suspectTags.length ? (
        suspectTags.map(tag => (
          <RadioLabel key={tag}>
            <Radio
              aria-label={tag}
              checked={tagSelected === tag}
              onChange={() => changeTag(tag)}
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
        <Center>
          <LoadingIndicator mini />
        </Center>
      ) : otherTags.length ? (
        otherTags.map(tag => (
          <RadioLabel key={tag}>
            <Radio
              aria-label={tag}
              checked={tagSelected === tag}
              onChange={() => changeTag(tag)}
            />
            <SidebarTagValue className="truncate">{tag}</SidebarTagValue>
          </RadioLabel>
        ))
      ) : (
        <div>{t('No tags detected.')}</div>
      )}
    </StyledSide>
  );
};

const Center = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const RadioLabel = styled('label')`
  cursor: pointer;
  margin-bottom: ${space(1)};
  font-weight: normal;
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

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-columns: auto 66%;
    align-content: start;
    gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
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

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledActions = styled('div')`
  margin-bottom: ${space(1)};
`;

export default TagsPageContent;
