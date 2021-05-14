import React, {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import SearchBar from 'app/components/events/searchBar';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import QuestionTooltip from 'app/components/questionTooltip';
import Radio from 'app/components/radio';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import SegmentExplorerQuery, {
  TableData,
} from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
import {decodeScalar} from 'app/utils/queryString';
import {SidebarSpacer} from 'app/views/performance/transactionSummary/utils';

import {getCurrentLandingDisplay, LandingDisplayField} from '../../landing/utils';
import {SpanOperationBreakdownFilter} from '../filter';
import TransactionHeader, {Tab} from '../header';
import {getTransactionField} from '../tagExplorer';

import TagsDisplay from './tagsDisplay';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
};

type TagOption = string;

const TagsPageContent = (props: Props) => {
  const {eventView, location, organization, projects, transactionName} = props;

  const handleIncompatibleQuery = () => {};

  const aggregateColumn = getTransactionField(
    SpanOperationBreakdownFilter.None,
    projects,
    eventView
  );

  return (
    <Fragment>
      <TransactionHeader
        eventView={eventView}
        location={location}
        organization={organization}
        projects={projects}
        transactionName={transactionName}
        currentTab={Tab.Tags}
        hasWebVitals={
          getCurrentLandingDisplay(location, projects, eventView).field ===
          LandingDisplayField.FRONTEND_PAGELOAD
        }
        handleIncompatibleQuery={handleIncompatibleQuery}
      />

      <SegmentExplorerQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        limit={20}
        order="-sumdelta"
        allTagKeys
      >
        {({isLoading, tableData}) => {
          return <InnerContent {...props} isLoading={isLoading} tableData={tableData} />;
        }}
      </SegmentExplorerQuery>
    </Fragment>
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
  const {eventView, location, organization, tableData} = props;

  if (!tableData) {
    return null;
  }

  const tagOptions = getTagKeyOptions(tableData);

  const defaultTag = tagOptions.suspectTags.length
    ? tagOptions.suspectTags[0]
    : tagOptions.otherTags.length
    ? tagOptions.otherTags[0]
    : '';
  const [tagSelected, changeTagSelected] = useState(defaultTag);

  useEffect(() => {
    if (defaultTag && !tagSelected) {
      changeTagSelected(defaultTag);
    }
  }, [defaultTag]);

  const handleSearch = (query: string) => {
    const queryParams = getParams({
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
    eventView.additionalConditions.setTagValues('has', [tagSelected]);
  }
  const query = decodeScalar(location.query.query, '');

  return (
    <ReversedLayoutBody>
      <TagsSideBar
        suspectTags={tagOptions.suspectTags}
        otherTags={tagOptions.otherTags}
        tagSelected={tagSelected}
        changeTag={changeTag}
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
  tagSelected: string;
  changeTag: (tag: string) => void;
  suspectTags: TagOption[];
  otherTags: TagOption[];
}) => {
  const {suspectTags, otherTags, changeTag, tagSelected} = props;
  return (
    <StyledSide>
      {suspectTags.length ? (
        <React.Fragment>
          <StyledSectionHeading>
            {t('Suspect Tags')}
            <QuestionTooltip
              position="top"
              title={t(
                'Suspect tags are tags that often correspond to slower transaction'
              )}
              size="sm"
            />
          </StyledSectionHeading>
          {suspectTags.map(tag => (
            <RadioLabel key={tag}>
              <Radio
                aria-label={tag}
                checked={tagSelected === tag}
                onChange={() => changeTag(tag)}
              />
              {tag}
            </RadioLabel>
          ))}

          <SidebarSpacer />
        </React.Fragment>
      ) : null}
      <StyledSectionHeading>
        {t('Other Tags')}
        <QuestionTooltip
          position="top"
          title={t('Other common tags for this transaction')}
          size="sm"
        />
      </StyledSectionHeading>
      {otherTags.map(tag => (
        <RadioLabel key={tag}>
          <Radio
            aria-label={tag}
            checked={tagSelected === tag}
            onChange={() => changeTag(tag)}
          />
          {tag}
        </RadioLabel>
      ))}
    </StyledSide>
  );
};

const RadioLabel = styled('label')`
  cursor: pointer;
  margin-bottom: ${space(1)};
  font-weight: normal;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  grid-gap: ${space(1)};
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin-bottom: ${space(2)};
`;

// TODO(k-fish): Adjust thirds layout to allow for this instead.
const ReversedLayoutBody = styled('div')`
  padding: ${space(2)};
  margin: 0;
  background-color: ${p => p.theme.background};
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(3)} ${space(4)};
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-columns: auto 66%;
    align-content: start;
    grid-gap: ${space(3)};
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
  margin-top: ${space(1)};
  margin-bottom: ${space(3)};
`;

export default TagsPageContent;
