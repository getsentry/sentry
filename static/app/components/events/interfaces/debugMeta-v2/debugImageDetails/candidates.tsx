import {Component} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelTable from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {CandidateDownloadStatus, Image, ImageStatus} from 'sentry/types/debugImage';
import {defined} from 'sentry/utils';

import SearchBarAction from '../../searchBarAction';
import SearchBarActionFilter from '../../searchBarAction/searchBarActionFilter';

import Status from './candidate/status';
import Candidate from './candidate';
import {INTERNAL_SOURCE} from './utils';

const filterOptionCategories = {
  status: t('Status'),
  source: t('Source'),
};

type FilterOptions = React.ComponentProps<typeof SearchBarActionFilter>['options'];

type ImageCandidates = Image['candidates'];

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
  filterOptions: FilterOptions;
  filteredCandidatesByFilter: ImageCandidates;
  filteredCandidatesBySearch: ImageCandidates;
  searchTerm: string;
};

class Candidates extends Component<Props, State> {
  state: State = {
    searchTerm: '',
    filterOptions: {},
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
    const {searchTerm, filterOptions} = this.state;
    const {candidates} = this.props;

    if (!searchTerm.trim()) {
      const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(
        candidates,
        filterOptions
      );

      this.setState({
        filteredCandidatesBySearch: candidates,
        filteredCandidatesByFilter,
      });
      return;
    }

    // Slightly hacky, but it works
    // the string is being `stringfy`d here in order to match exactly the same `stringfy`d string of the loop
    const searchFor = JSON.stringify(searchTerm)
      // it replaces double backslash generate by JSON.stringfy with single backslash
      .replace(/((^")|("$))/g, '')
      .toLocaleLowerCase();

    const filteredCandidatesBySearch = candidates.filter(obj =>
      Object.keys(pick(obj, ['source_name', 'location'])).some(key => {
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
      filterOptions
    );

    this.setState({
      filteredCandidatesBySearch,
      filteredCandidatesByFilter,
    });
  }

  doSearch = debounce(this.filterCandidatesBySearch, 300);

  getFilters() {
    const candidates = [...this.props.candidates];
    const filterOptions = this.getFilterOptions(candidates);
    this.setState({
      filterOptions,
      filteredCandidatesBySearch: candidates,
      filteredCandidatesByFilter: this.getFilteredCandidatedByFilter(
        candidates,
        filterOptions
      ),
    });
  }

  getFilterOptions(candidates: ImageCandidates) {
    const {imageStatus} = this.props;

    const filterOptions = {};

    const candidateStatus = [
      ...new Set(candidates.map(candidate => candidate.download.status)),
    ];

    if (candidateStatus.length > 1) {
      filterOptions[filterOptionCategories.status] = candidateStatus.map(status => ({
        id: status,
        symbol: <Status status={status} />,
        isChecked:
          status !== CandidateDownloadStatus.NOT_FOUND ||
          imageStatus === ImageStatus.MISSING,
      }));
    }

    const candidateSources = [
      ...new Set(candidates.map(candidate => candidate.source_name ?? t('Unknown'))),
    ];

    if (candidateSources.length > 1) {
      filterOptions[filterOptionCategories.source] = candidateSources.map(sourceName => ({
        id: sourceName,
        symbol: sourceName,
        isChecked: false,
      }));
    }

    return filterOptions as FilterOptions;
  }

  getFilteredCandidatedByFilter(
    candidates: ImageCandidates,
    filterOptions: FilterOptions
  ) {
    const checkedStatusOptions = new Set(
      filterOptions[filterOptionCategories.status]
        ?.filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    const checkedSourceOptions = new Set(
      filterOptions[filterOptionCategories.source]
        ?.filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    if (checkedStatusOptions.size === 0 && checkedSourceOptions.size === 0) {
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
    const {searchTerm, filteredCandidatesByFilter: images, filterOptions} = this.state;

    if (!!images.length) {
      return {};
    }

    const hasActiveFilter = Object.values(filterOptions)
      .flatMap(filterOption => filterOption)
      .find(filterOption => filterOption.isChecked);

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

  handleChangeFilter = (filterOptions: FilterOptions) => {
    const {filteredCandidatesBySearch} = this.state;
    const filteredCandidatesByFilter = this.getFilteredCandidatedByFilter(
      filteredCandidatesBySearch,
      filterOptions
    );
    this.setState({filterOptions, filteredCandidatesByFilter});
  };

  handleResetFilter = () => {
    const {filterOptions} = this.state;

    this.setState(
      {
        filterOptions: Object.keys(filterOptions).reduce((accumulator, currentValue) => {
          accumulator[currentValue] = filterOptions[currentValue].map(filterOption => ({
            ...filterOption,
            isChecked: false,
          }));
          return accumulator;
        }, {}),
      },
      this.filterCandidatesBySearch
    );
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

    const {searchTerm, filterOptions, filteredCandidatesByFilter} = this.state;

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
              filter={
                <SearchBarActionFilter
                  options={filterOptions}
                  onChange={this.handleChangeFilter}
                />
              }
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
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
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
  font-weight: 600;
  color: ${p => p.theme.gray400};
  height: 32px;
  flex: 1;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    margin-bottom: ${space(1)};
  }
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: ${p =>
    p.headers.length === 3 ? 'max-content 1fr max-content' : 'max-content 1fr'};

  height: 100%;

  @media (min-width: ${props => props.theme.breakpoints[4]}) {
    overflow: visible;
  }
`;

const StyledSearchBarAction = styled(SearchBarAction)`
  margin-bottom: ${space(1.5)};
`;
