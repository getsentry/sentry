import React from 'react';
import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import $ from 'jquery';
import queryString from 'query-string';
import _ from 'lodash';

import Count from 'app/components/count';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';

const generateRequest = input => {
  const {params = {}, ...request} = input;

  const access_token = localStorage.getItem('stackexchange_access_token');

  if (access_token) {
    params.access_token = access_token;
    params.key = '6065CS6mUaSWL)Vv)Spfgg((';
  }

  request.url = `${request.url}?${queryString.stringify(params)}`;

  return request;
};

class GenerateQuery extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  state = {
    query: '',
    loading: true,
    error: null,
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    this.fetchData();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchData = () => {
    const {api, project, organization, event} = this.props;

    this.setState({
      loading: true,
    });

    api.request(
      `/projects/${organization.slug}/${project.slug}/events/${event.id}/stackexchange/`,
      {
        success: data => {
          if (!this._isMounted) {
            return;
          }

          const query = _.get(data, ['query'], '');

          this.setState({
            query: _.isString(query) ? query : '',
            loading: false,
            error: null,
          });
        },
        error: err => {
          if (!this._isMounted) {
            return;
          }

          this.setState({
            query: '',
            questions: [],
            loading: false,
            error: err,
          });
        },
      }
    );
  };

  render() {
    if (this.state.loading) {
      return null;
    }

    if (!!this.state.error) {
      return null;
    }

    const childProps = {
      query: this.state.query,
    };

    return this.props.children(childProps);
  }
}

class StackExchangeSites extends React.Component {
  state = {
    sites: [],
    loading: true,
    error: null,

    authenticated: false,
    ready: false,

    currentSite: {
      name: 'Stack Overflow',
      api_site_parameter: 'stackoverflow',
      icon: 'https://cdn.sstatic.net/Sites/stackoverflow/img/apple-touch-icon.png',
      site_url: 'https://stackoverflow.com',
    },
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  async componentDidMount() {
    this._isMounted = true;

    const authenticated = await this.checkAccessToken();

    const statePayload = await this.fetchData();

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({
      authenticated,
      ready: true,
      ...statePayload,
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  checkAccessToken = () => {
    // returns true if user is authenticated, false otherwise
    return new Promise(resolve => {
      const expected_access_token = localStorage.getItem('stackexchange_access_token');

      if (!expected_access_token) {
        localStorage.removeItem('stackexchange_access_token');
        resolve(false);
        return;
      }

      const request = generateRequest({
        url: `https://api.stackexchange.com/2.2/access-tokens/${expected_access_token}`,
        method: 'GET',
      });

      $.ajax(request)
        .then(results => {
          if (!this._isMounted) {
            return;
          }

          const actual_access_token = _.get(results, ['items', '0', 'access_token']);

          const authenticated = actual_access_token === expected_access_token;

          resolve(authenticated);
          return;
        })
        .fail(err => {
          if (!this._isMounted) {
            return;
          }

          const error_id = _.get(err, 'responseJSON.error_id');

          if (error_id === 403) {
            // invalid access token
            localStorage.removeItem('stackexchange_access_token');
          }

          resolve(false);
          return;
        });
    });
  };

  fetchData = () => {
    const request = generateRequest({
      url: 'https://api.stackexchange.com/2.2/sites',
      method: 'GET',
    });

    return new Promise(resolve => {
      // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)
      $.ajax(request)
        .then(results => {
          if (!this._isMounted) {
            return;
          }

          resolve({
            sites: results.items,
            loading: false,
            error: null,
          });
          return;
        })
        .fail(err => {
          if (!this._isMounted) {
            return;
          }

          resolve({
            sites: [],
            loading: false,
            error: err,
          });
          return;
        });
    });
  };

  onSelect = ({value}) => {
    const site = value;
    this.setState({
      currentSite: {
        name: site.name,
        api_site_parameter: site.api_site_parameter,
        icon: site.icon_url,
        site_url: site.site_url,
      },
    });
  };

  generateMenuList = () => {
    return this.state.sites.map(site => {
      return {
        value: site,
        searchKey: site.name,
        label: (
          <span>
            <img height="20" width="20" src={site.icon_url} /> {String(site.name)}
          </span>
        ),
      };
    });
  };

  hasAuthenticated = () => {
    this.setState({
      authenticated: true,
    });
  };

  render() {
    if (this.state.loading) {
      return null;
    }

    if (!!this.state.error) {
      return null;
    }

    const childProps = {
      sites: this.state.sites,
      menuList: this.generateMenuList(),
      onSelect: this.onSelect,
      currentSite: this.state.currentSite,
      authenticated: this.state.authenticated,
      hasAuthenticated: this.hasAuthenticated,
    };

    return this.props.children(childProps);
  }
}
class StackExchangeResults extends React.PureComponent {
  Results;
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    query: PropTypes.string.isRequired,

    currentSite: PropTypes.shape({
      name: PropTypes.string.isRequired,
      api_site_parameter: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      site_url: PropTypes.string.isRequired,
    }).isRequired,
  };

  state = {
    questions: [],
    loading: true,
    error: null,
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    this.fetchData();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchData = () => {
    const {query, event} = this.props;

    const params = {
      q: query,
      order: 'desc',
      sort: 'relevance',
      site: this.props.currentSite.api_site_parameter,
      tagged: event.platform,
    };

    const request = generateRequest({
      url: 'https://api.stackexchange.com/2.2/search/advanced',
      method: 'GET',
      params,
    });

    // We can't use the API client here since the URL is not scoped under the
    // API endpoints (which the client prefixes)
    $.ajax(request)
      .then(results => {
        if (!this._isMounted) {
          return;
        }

        this.setState({
          questions: results.items,
          loading: false,
          error: null,
        });
      })
      .fail(err => {
        if (!this._isMounted) {
          return;
        }

        this.setState({
          questions: [],
          loading: false,
          error: err,
        });
      });
  };

  renderHeaders() {
    return (
      <Sticky>
        <StyledFlex py={1}>
          <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
            <ToolbarHeader>{t('Question')}</ToolbarHeader>
          </Box>
          <Box w={16} mx={2} className="align-right" />
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Answers')}</ToolbarHeader>
          </Box>
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Views')}</ToolbarHeader>
          </Box>
        </StyledFlex>
      </Sticky>
    );
  }

  decode(escapedHtml) {
    const doc = new DOMParser().parseFromString(escapedHtml, 'text/html');
    return doc.documentElement.textContent;
  }

  renderStackExchangeQuestion = question => {
    const hasAcceptedAnswer = !!question.accepted_answer_id;

    // if there is an accepted answer, we link to it, otherwise, we link to the
    // stackoverflow question
    const question_link = hasAcceptedAnswer
      ? `${this.props.currentSite.site_url}/a/${question.accepted_answer_id}`
      : question.link;

    return (
      <Group key={question.question_id} py={1} px={0} align="center">
        <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
          <QuestionWrapper>
            {hasAcceptedAnswer && (
              <div style={{color: '#57be8c'}}>
                <span className="icon-checkmark" />
              </div>
            )}
            <a href={question_link} target="_blank" rel="noopener noreferrer">
              {this.decode(question.title)}
            </a>
          </QuestionWrapper>
          <StyledTags>
            {question.tags.map(tag => (
              <a
                className="btn btn-default btn-sm"
                key={tag}
                href={`${this.props.currentSite.site_url}/questions/tagged/${tag}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {tag}
              </a>
            ))}
          </StyledTags>
        </Box>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          <StyledCount value={question.answer_count} />
        </Flex>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          <StyledCount value={question.view_count} />
        </Flex>
      </Group>
    );
  };

  renderAskOnStackOverflow() {
    const {query} = this.props;
    const {platform} = this.props.event;

    return (
      <a
        className="btn btn-default btn-sm"
        href={`${
          this.props.currentSite.site_url
        }/questions/ask?tags=${platform}&title=${encodeURIComponent(query)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t(`Don't see your issue? Ask on ${this.props.currentSite.name}!`)}
      </a>
    );
  }

  renderSeeMoreResults() {
    const {platform} = this.props.event;

    const query = `[${platform}] ${this.props.query}`;

    return (
      <a
        className="btn btn-default btn-sm"
        href={`${this.props.currentSite.site_url}/search?q=${encodeURIComponent(query)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        See more results
      </a>
    );
  }

  renderBody = () => {
    const top3 = this.state.questions.slice(0, 3);

    if (this.state.loading) {
      return (
        <EmptyMessage>
          <LoadingIndicator mini>Loading</LoadingIndicator>
        </EmptyMessage>
      );
    }

    if (top3.length <= 0) {
      return <EmptyMessage>{t('No results')}</EmptyMessage>;
    }

    return <PanelBody>{top3.map(this.renderStackExchangeQuestion)}</PanelBody>;
  };

  render() {
    // if (!!this.state.error) {
    //   return null;
    // }

    return (
      <React.Fragment>
        <Panel>
          {this.renderHeaders()}
          {this.renderBody()}
        </Panel>
        <ButtonListControls>
          {this.renderAskOnStackOverflow()}
          {this.renderSeeMoreResults()}
        </ButtonListControls>
      </React.Fragment>
    );
  }
}

class Settings extends React.Component {
  propTypes = {
    authenticated: PropTypes.bool.isRequired,
    hasAuthenticated: PropTypes.func.isRequired,
  };

  popup = null;

  componentDidMount() {
    this._isMounted = true;

    window.addEventListener('message', this.receiveMessage, false);
  }

  componentWillUnmount() {
    this._isMounted = false;
    window.removeEventListener('message', this.receiveMessage, false);
  }

  receiveMessage = event => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.source !== this.popup) {
      return;
    }

    if (event.data === 'stackexchange_implicit_oauth_flow_done') {
      if (this.popup) {
        this.popup.close();
        this.popup = null;

        this.props.hasAuthenticated();
      }
    }
  };

  handleAuthenticate = event => {
    event.preventDefault();

    const params = {
      client_id: '15653',
      redirect_uri: `${window.location.origin}/implicitoauth/`,
      scope: 'no_expiry',
    };

    const AUTHORIZATION_URL = `https://stackoverflow.com/oauth/dialog?${queryString.stringify(
      params
    )}`;

    this.popup = window.open(
      AUTHORIZATION_URL,
      'Login to StackExchange',
      'width=800,height=600'
    );
  };

  renderAuthenticationMessage = () => {
    if (this.props.authenticated) {
      return <span>{t('You are authenticated')}</span>;
    }

    return (
      <a href="#authenticate" onClick={this.handleAuthenticate}>
        Authenticate through StackExchange
      </a>
    );
  };

  render() {
    return (
      <Panel>
        <Sticky>
          <StyledFlex py={1}>
            <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
              <ToolbarHeader>{t('Settings')}</ToolbarHeader>
            </Box>
          </StyledFlex>
        </Sticky>
        <EmptyMessage>{this.renderAuthenticationMessage()}</EmptyMessage>
      </Panel>
    );
  }
}

class StackExchange extends React.Component {
  state = {
    view: 'results',
  };

  setView = nextView => {
    this.setState({
      view: nextView,
    });
  };

  render() {
    const {api, organization, project, event} = this.props;

    return (
      <GenerateQuery {...{api, organization, project, event}}>
        {({query}) => {
          return (
            <StackExchangeSites>
              {({
                sites,
                menuList,
                onSelect,
                currentSite,
                authenticated,
                hasAuthenticated,
              }) => {
                return (
                  <div className="extra-data box">
                    <div className="box-header" id="stackexchange">
                      <a href="#stackexchange" className="permalink">
                        <em className="icon-anchor" />
                      </a>
                      <GuideAnchor target="stackexchange" type="text" />
                      <h3>
                        <DropdownAutoComplete
                          items={menuList}
                          alignMenu="left"
                          onSelect={onSelect}
                        >
                          {({isOpen, selectedItem}) => {
                            return selectedItem ? (
                              selectedItem.label
                            ) : (
                              <span>
                                <img height="20" width="20" src={currentSite.icon} />{' '}
                                {String(currentSite.name)}
                              </span>
                            );
                          }}
                        </DropdownAutoComplete>
                      </h3>
                      <div className="btn-group" style={{marginLeft: 10}}>
                        <a
                          className={
                            (this.state.view === 'results' ? 'active' : '') +
                            ' btn btn-default btn-sm'
                          }
                          onClick={() => this.setView('results')}
                        >
                          {t('Results')}
                        </a>
                        <a
                          className={
                            (this.state.view === 'settings' ? 'active' : '') +
                            ' btn btn-default btn-sm'
                          }
                          onClick={() => this.setView('settings')}
                        >
                          {t('Settings')}
                        </a>
                      </div>
                    </div>

                    <Display visible={this.state.view === 'settings'}>
                      <Settings
                        authenticated={authenticated}
                        hasAuthenticated={hasAuthenticated}
                      />
                    </Display>
                    <Display visible={this.state.view === 'results'}>
                      <StackExchangeResults
                        key={currentSite.api_site_parameter}
                        sites={sites}
                        menuList={menuList}
                        onSelect={onSelect}
                        currentSite={currentSite}
                        query={query}
                        {...this.props}
                      />
                    </Display>
                  </div>
                );
              }}
            </StackExchangeSites>
          );
        }}
      </GenerateQuery>
    );
  }
}

StackExchange.propTypes = {
  api: PropTypes.object.isRequired,
  organization: SentryTypes.Organization.isRequired,
  project: SentryTypes.Project.isRequired,
  event: SentryTypes.Event.isRequired,
};

const Group = styled(PanelItem)`
  line-height: 1.1;
`;

const Sticky = styled('div')`
  position: sticky;
  z-index: ${p => p.theme.zIndex.header};
  top: -1px;
`;

const StyledFlex = styled(Flex)`
  align-items: center;
  background: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin-bottom: -1px;
`;

const StyledCount = styled(Count)`
  font-size: 18px;
  color: ${p => p.theme.gray3};
`;

const ButtonList = styled('div')`
  > * + * {
    margin-left: ${space(1)};
  }
`;

const StyledTags = styled(ButtonList)`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const ButtonListControls = styled(ButtonList)`
  margin-top: -${space(1)};
  margin-bottom: ${space(3)};
`;

const QuestionWrapper = styled('div')`
  display: flex;
  align-items: center;

  padding-top: ${space(1)};
  padding-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
`;

const Display = styled('div')`
  ${props => {
    return `display: ${props.visible ? 'block' : 'none'};`;
  }};
`;

export default withApi(StackExchange);
