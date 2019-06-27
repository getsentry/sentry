import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import _ from 'lodash';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';

import GenerateQuery from './generate_query';
import StackExchangeSites from './stackexchange_sites';
import StackExchangeResults from './stackexchange_results';
import Settings from './settings';

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
