import {Flex} from 'grid-emotion';
import {Link} from 'react-router';
import {css} from 'emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {loadSearchMap} from '../../../actionCreators/formSearch';
import {navigateTo} from '../../../actionCreators/navigation';
import {t} from '../../../locale';
import ApiSearch from '../../../components/search/apiSearch';
import AutoComplete from '../../../components/autoComplete';
import FormFieldSearch from '../../../components/search/formFieldSearch';
import InlineSvg from '../../../components/inlineSvg';
import LoadingIndicator from '../../../components/loadingIndicator';
import TeamAvatar from '../../../components/teamAvatar';
import UserBadge from '../../../components/userBadge';
import replaceRouterParams from '../../../utils/replaceRouterParams';
import SentryTypes from '../../../proptypes';

const MIN_SEARCH_LENGTH = 2;

class SearchResult extends React.Component {
  static propTypes = {
    /**
     * The source of the search result (i.e. a model type)
     */
    sourceType: PropTypes.oneOf(['organization', 'project', 'team', 'member', 'field']),
    /**
     * The type of result this is, for example:
     * - can be a setting route,
     * - an application route (e.g. org dashboard)
     * - form field
     */
    resultType: PropTypes.oneOf(['settings', 'route', 'field']),
    field: PropTypes.object,
    model: PropTypes.oneOfType([
      SentryTypes.Organization,
      SentryTypes.Project,
      SentryTypes.Team,
      SentryTypes.Member,
    ]),
  };

  renderResultType() {
    let {resultType} = this.props;

    // let isRoute = resultType === 'route';
    let isSettings = resultType === 'settings';
    let isField = resultType === 'field';

    if (isSettings) {
      return <ResultTypeIcon src="icon-settings" />;
    }

    if (isField) {
      return <ResultTypeIcon src="icon-input" />;
    }

    return <ResultTypeIcon src="icon-location" />;
  }

  renderContent() {
    let {sourceType, resultType, field, model, params} = this.props;

    let isSettings = resultType === 'settings';

    if (sourceType === 'team') {
      return (
        <React.Fragment>
          <div>
            <TeamAvatar team={model} />
            #{model.slug}
          </div>

          <ResultContext>Settings</ResultContext>
        </React.Fragment>
      );
    }

    if (sourceType === 'member') {
      return <UserBadge userLink={false} orgId={params.orgId} user={model} />;
    }

    if (sourceType === 'organization') {
      return (
        <React.Fragment>
          {model.slug}{' '}
          <ResultContext>
            Organization {isSettings ? ' Settings' : ' Dashboard'}
          </ResultContext>
        </React.Fragment>
      );
    }

    if (sourceType === 'project') {
      return (
        <React.Fragment>
          {model.slug}{' '}
          <ResultContext>Project {isSettings ? ' Settings' : ' Issues'}</ResultContext>
        </React.Fragment>
      );
    }

    if (sourceType === 'field') {
      return (
        <React.Fragment>
          <div>
            <span>{field.label}</span>
          </div>

          <SearchDetail>{field.help}</SearchDetail>
        </React.Fragment>
      );
    }

    return null;
  }

  render() {
    return (
      <Flex justify="space-between" align="center">
        <Content>{this.renderContent()}</Content>
        {this.renderResultType()}
      </Flex>
    );
  }
}

class SettingsSearch extends React.Component {
  static propTypes = {
    route: PropTypes.object,
    router: PropTypes.object,
  };

  componentDidMount() {
    loadSearchMap();
  }

  handleSelect = (item, state) => {
    if (!item) return;

    let {to} = item;
    if (!to) return;

    let {params, router} = this.props;
    let nextPath = replaceRouterParams(to, params);

    navigateTo(nextPath, router);
  };

  render() {
    let {params} = this.props;

    return (
      <AutoComplete
        defaultHighlightedIndex={0}
        itemToString={() => ''}
        onSelect={this.handleSelect}
        onStateChange={this.handleStateChange}
      >
        {({
          getInputProps,
          getItemProps,
          isOpen,
          inputValue,
          selectedItem,
          highlightedIndex,
          onChange,
        }) => {
          let searchQuery = inputValue.toLowerCase();
          let isValidSearch = inputValue.length > MIN_SEARCH_LENGTH;

          return (
            <SettingsSearchWrapper>
              <SearchInputWrapper>
                <SearchInputIcon size="14px" />
                <SearchInput
                  {...getInputProps({
                    type: 'text',
                    placeholder: t('Search settings'),
                  })}
                />
              </SearchInputWrapper>

              {isValidSearch && isOpen ? (
                <ApiSearch query={searchQuery}>
                  {({isLoading: apiIsLoading, results: apiResults}) => {
                    return (
                      <FormFieldSearch params={params} query={searchQuery}>
                        {({isLoading: fieldIsLoading, results: fieldResults}) => {
                          let isLoading =
                            apiIsLoading ||
                            fieldIsLoading ||
                            apiResults === null ||
                            fieldResults === null;
                          let hasApiResults =
                            !isLoading && apiResults && !!apiResults.length;
                          let hasFieldResults =
                            !isLoading && fieldResults && !!fieldResults.length;
                          let hasAnyResults = hasFieldResults || hasApiResults;
                          let results = !isLoading
                            ? (apiResults || []).concat(fieldResults || [])
                            : [];

                          return (
                            <DropdownBox>
                              {isLoading && (
                                <Flex justify="center" align="center" p={1}>
                                  <LoadingIndicator mini hideMessage relative />
                                </Flex>
                              )}
                              {results.map((item, index) => {
                                return (
                                  <SearchItem
                                    {...getItemProps({
                                      item,
                                    })}
                                    highlighted={index === highlightedIndex}
                                    key={`${item.searchIndex}:${item.sourceType}:${item.resultType}`}
                                  >
                                    <SearchResult {...item} {...this.props} />
                                  </SearchItem>
                                );
                              })}

                              {!isLoading &&
                                !hasAnyResults && (
                                  <SearchItem>{t('No results found')}</SearchItem>
                                )}
                            </DropdownBox>
                          );
                        }}
                      </FormFieldSearch>
                    );
                  }}
                </ApiSearch>
              ) : null}
            </SettingsSearchWrapper>
          );
        }}
      </AutoComplete>
    );
  }
}

export default SettingsSearch;

const SearchInputWrapper = styled.div`
  position: relative;
`;

const SearchInputIcon = styled(props => <InlineSvg src="icon-search" {...props} />)`
  color: ${p => p.theme.gray2}
  position: absolute;
  left: 10px;
  top: 8px;
`;

const SearchInput = styled.input`
  transition: border-color 0.15s ease;
  font-size: 14px;
  width: 260px;
  line-height: 1;
  padding: 5px 8px 4px 28px;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 30px;
  height: 28px;

  box-shadow: inset ${p => p.theme.dropShadowLight};

  &:focus {
    outline: none;
    border: 1px solid ${p => p.theme.gray1};
  }

  &::placeholder {
    color: ${p => p.theme.gray2};
  }
`;

const DropdownBox = styled.div`
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  position: absolute;
  top: 36px;
  right: 0;
  width: 400px;
  border-radius: 5px;
`;

const SettingsSearchWrapper = styled.div`
  position: relative;
`;

const SearchItem = styled(({highlighted, ...props}) => <Link {...props} />)`
  display: block;
  color: ${p => p.theme.gray5};
  padding: 10px;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purpleDarkest};
      background: ${p.theme.offWhite};
    `} &:first-child {
    border-radius: 5px 5px 0 0;
  }

  &:last-child {
    border-bottom: 0;
    border-radius: 0 0 5px 5px;
  }
`;

const SearchDetail = styled.div`
  font-size: 0.8em;
  line-height: 1.3;
  margin-top: 4px;
  color: ${p => p.theme.gray3};
`;

const Content = styled(props => <Flex direction="column" {...props} />)``;

const ResultTypeIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray1};
  font-size: 1.2em;
`;

const ResultContext = styled.span`
  opacity: 0.6;
  font-size: 0.8em;
  margin-top: 4px;
`;
