import {Component} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {Button} from 'sentry/components/button';
import type {SelectOption, SelectSection} from 'sentry/components/compactSelect';
import ExternalLink from 'sentry/components/links/externalLink';
import {PanelTable} from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Image} from 'sentry/types/debugImage';
import {CandidateDownloadStatus, ImageStatus} from 'sentry/types/debugImage';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';

import SearchBarAction from '../../searchBarAction';

import Status from './candidate/status';
import Candidate from './candidate';
import {INTERNAL_SOURCE} from './utils';

const filterOptionCategories = {
  status: t('Status'),
  source: t('Source'),
};

type ImageCandidates = NonNullable<Image['candidates']>;

type Props = {
  baseUrl: string;
  candidates: ImageCandidates;
  hasReprocessWarning: boolean;
  isLoading: boolean;
  onDelete: (debugId: string) => void;
  organization: Organization;
  projSlug: Project['slug'];
  eventDateReceived?: string;
  imageStatus?: ImageStatus;
};

type State = {
  filterOptions: SelectSection<string>[];
  filterSelections: SelectOption<string>[];
  filteredCandidatesByFilter: ImageCandidates;
  filteredCandidatesBySearch: ImageCandidates;
  searchTerm: string;
};

class Candidates extends Component<Props, State> {
  state: State = {
    searchTerm: '',
    filterOptions: [],
    filterSelections: [],
    filteredCandidatesBySearch: [],
    filteredCandidatesByFilter: [],
  };

  componentDidMount() {
    this.getFilters();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!isEqual(prevProps.candidates, this.props.candidates)) {
      this.getFilters();
      return;
    }

    if (prevState.searchTerm !== this.state.searchTerm) {
      this.doSearch();
    }
  }

  filterCandidatesBySearch() {
    const {searchTerm, filterSelections} = this.state;
    const {candidates} = this.props;

    if (!searchTerm.trim()) {
      const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(
        candidates,
        filterSelections
      );

      this.setState({
        filteredCandidatesBySearch: candidates,
        filteredCandidatesByFilter,
      });
      return;
    }

    // Slightly hacky, but it works
    // the string is being `stringify`d here in order to match exactly the same `stringify`d string of the loop
    const searchFor = JSON.stringify(searchTerm)
      // it replaces double backslash generate by JSON.stringify with single backslash
      .replace(/((^")|("$))/g, '')
      .toLocaleLowerCase();

    const filteredCandidatesBySearch = candidates.filter(obj =>
      Object.keys(pick(obj, ['source_name', 'location'])).some(key => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const info = obj[key];

        if (key === 'location' && typeof Number(info) === 'number') {
          return false;
        }

        if (!defined(info) || !String(info).trim()) {
          return false;
        }

        return JSON.stringify(info)
          .replace(/((^")|("$))/g, '')
          .toLocaleLowerCase()
          .trim()
          .includes(searchFor);
      })
    );

    const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(
      filteredCandidatesBySearch,
      filterSelections
    );

    this.setState({
      filteredCandidatesBySearch,
      filteredCandidatesByFilter,
    });
  }

  doSearch = debounce(this.filterCandidatesBySearch, 300);

  getFilters() {
    const {imageStatus} = this.props;
    const candidates = [...this.props.candidates];
    const filterOptions = this.getFilterOptions(candidates);

    const defaultFilterSelections = (
      filterOptions.find(section => section.key === 'status')?.options ?? []
    ).filter(
      opt =>
        opt.value !== `status-${CandidateDownloadStatus.NOT_FOUND}` ||
        imageStatus === ImageStatus.MISSING
    );

    this.setState({
      filterOptions,
      filterSelections: defaultFilterSelections,
      filteredCandidatesBySearch: candidates,
      filteredCandidatesByFilter: this.getFilteredCandidatedByFilter(
        candidates,
        defaultFilterSelections
      ),
    });
  }

  getFilterOptions(candidates: ImageCandidates) {
    const filterOptions: SelectSection<string>[] = [];

    const candidateStatus = [
      ...new Set(candidates.map(candidate => candidate.download.status)),
    ];

    if (candidateStatus.length > 1) {
      filterOptions.push({
        key: 'status',
        label: filterOptionCategories.status,
        options: candidateStatus.map(status => ({
          value: `status-${status}`,
          textValue: status,
          label: <Status status={status} />,
        })),
      });
    }

    const candidateSources = [
      ...new Set(candidates.map(candidate => candidate.source_name ?? t('Unknown'))),
    ];

    if (candidateSources.length > 1) {
      filterOptions.push({
        key: 'source',
        label: filterOptionCategories.source,
        options: candidateSources.map(sourceName => ({
          value: `source-${sourceName}`,
          label: sourceName,
        })),
      });
    }

    return filterOptions;
  }

  getFilteredCandidatedByFilter(
    candidates: ImageCandidates,
    filterOptions: SelectOption<string>[]
  ) {
    const checkedStatusOptions = new Set(
      filterOptions
        .filter(option => option.value.split('-')[0] === 'status')
        .map(option => option.value.split('-')[1])
    );

    const checkedSourceOptions = new Set(
      filterOptions
        .filter(option => option.value.split('-')[0] === 'source')
        .map(option => option.value.split('-')[1])
    );

    if (filterOptions.length === 0) {
      return candidates;
    }

    if (checkedStatusOptions.size > 0) {
      const filteredByStatus = candidates.filter(candidate =>
        checkedStatusOptions.has(candidate.download.status)
      );

      if (checkedSourceOptions.size === 0) {
        return filteredByStatus;
      }

      return filteredByStatus.filter(candidate =>
        checkedSourceOptions.has(candidate?.source_name ?? '')
      );
    }

    return candidates.filter(candidate =>
      checkedSourceOptions.has(candidate?.source_name ?? '')
    );
  }

  getEmptyMessage() {
    const {searchTerm, filteredCandidatesByFilter: images, filterSelections} = this.state;

    if (images.length) {
      return {};
    }

    const hasActiveFilter = filterSelections.length > 0;

    if (searchTerm || hasActiveFilter) {
      return {
        emptyMessage: t('Sorry, no debug files match your search query'),
        emptyAction: hasActiveFilter ? (
          <Button onClick={this.handleResetFilter} priority="primary">
            {t('Reset filter')}
          </Button>
        ) : (
          <Button onClick={this.handleResetSearchBar} priority="primary">
            {t('Clear search bar')}
          </Button>
        ),
      };
    }

    return {
      emptyMessage: t('There are no debug files to be displayed'),
    };
  }

  handleChangeSearchTerm = (searchTerm = '') => {
    this.setState({searchTerm});
  };

  handleChangeFilter = (filterSelections: SelectOption<string>[]) => {
    const {filteredCandidatesBySearch} = this.state;
    const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(
      filteredCandidatesBySearch,
      filterSelections
    );
    this.setState({filterSelections, filteredCandidatesByFilter});
  };

  handleResetFilter = () => {
    this.setState({filterSelections: []}, this.filterCandidatesBySearch);
  };

  handleResetSearchBar = () => {
    const {candidates} = this.props;

    this.setState({
      searchTerm: '',
      filteredCandidatesByFilter: candidates,
      filteredCandidatesBySearch: candidates,
    });
  };

  render() {
    const {
      organization,
      projSlug,
      baseUrl,
      onDelete,
      isLoading,
      candidates,
      eventDateReceived,
      hasReprocessWarning,
    } = this.props;

    const {searchTerm, filterOptions, filterSelections, filteredCandidatesByFilter} =
      this.state;

    const haveCandidatesOkOrDeletedDebugFile = candidates.some(
      candidate =>
        (candidate.download.status === CandidateDownloadStatus.OK &&
          candidate.source === INTERNAL_SOURCE) ||
        candidate.download.status === CandidateDownloadStatus.DELETED
    );
    const haveCandidatesAtLeastOneAction =
      haveCandidatesOkOrDeletedDebugFile || hasReprocessWarning;

    return (
      <Wrapper>
        <Header>
          <Title>
            {t('Debug File Candidates')}
            <QuestionTooltip
              title={tct(
                'These are the Debug Information Files (DIFs) corresponding to this image which have been looked up on [docLink:symbol servers] during the processing of the stacktrace.',
                {
                  docLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/native/data-management/debug-files/symbol-servers/" />
                  ),
                }
              )}
              size="xs"
              position="top"
              isHoverable
            />
          </Title>
          {!!candidates.length && (
            <StyledSearchBarAction
              query={searchTerm}
              onChange={value => this.handleChangeSearchTerm(value)}
              placeholder={t('Search debug file candidates')}
              filterOptions={filterOptions}
              filterSelections={filterSelections}
              onFilterChange={this.handleChangeFilter}
            />
          )}
        </Header>
        <StyledPanelTable
          headers={
            haveCandidatesAtLeastOneAction
              ? [t('Status'), t('Information'), '']
              : [t('Status'), t('Information')]
          }
          isEmpty={!filteredCandidatesByFilter.length}
          isLoading={isLoading}
          {...this.getEmptyMessage()}
        >
          {filteredCandidatesByFilter.map((candidate, index) => (
            <Candidate
              key={index}
              candidate={candidate}
              organization={organization}
              baseUrl={baseUrl}
              projSlug={projSlug}
              eventDateReceived={eventDateReceived}
              hasReprocessWarning={hasReprocessWarning}
              haveCandidatesAtLeastOneAction={haveCandidatesAtLeastOneAction}
              onDelete={onDelete}
            />
          ))}
        </StyledPanelTable>
      </Wrapper>
    );
  }
}

export default Candidates;

const Wrapper = styled('div')`
  display: grid;
`;

const Header = styled('div')`
  display: flex;
  flex-direction: column;
  @media (min-width: ${props => props.theme.breakpoints.small}) {
    flex-wrap: wrap;
    flex-direction: row;
  }
`;

const Title = styled('div')`
  padding-right: ${space(4)};
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray400};
  height: 32px;
  flex: 1;

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    margin-bottom: ${space(1)};
  }
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: ${p =>
    p.headers.length === 3 ? 'max-content 1fr max-content' : 'max-content 1fr'};

  height: 100%;

  @media (min-width: ${props => props.theme.breakpoints.xxlarge}) {
    overflow: visible;
  }
`;

const StyledSearchBarAction = styled(SearchBarAction)`
  margin-bottom: ${space(1.5)};
`;
