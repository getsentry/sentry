import React from 'react';
import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import queryString from 'query-string';
import _ from 'lodash';

import {Panel} from 'app/components/panels';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {Sticky, StyledFlex} from './styles';
import GenerateQuery from './generate_query';
import StackExchangeSites from './stackexchange_sites';
import StackExchangeResults from './stackexchange_results';

class Settings extends React.Component {
  propTypes = {
    authenticated: PropTypes.bool.isRequired,
    hasAuthenticated: PropTypes.func.isRequired,
  };

  // eslint-disable-next-line react/sort-comp
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

const Display = styled('div')`
  ${props => {
    return `display: ${props.visible ? 'block' : 'none'};`;
  }};
`;

export default withApi(StackExchange);
