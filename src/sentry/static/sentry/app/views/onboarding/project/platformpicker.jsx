import PropTypes from 'prop-types';
import React from 'react';
import classnames from 'classnames';

import ListLink from '../../../components/listLink';
import {flattenedPlatforms, categoryLists} from '../utils';
import PlatformCard from './platformCard';
import {t} from '../../../locale';

const categoryList = Object.keys(categoryLists).concat('All');

const PlatformPicker = React.createClass({
  propTypes: {
    setPlatform: PropTypes.func.isRequired,
    platform: PropTypes.string,
    showOther: PropTypes.bool
  },

  getDefaultProps() {
    return {showOther: true};
  },

  getInitialState() {
    return {
      tab: categoryList[0],
      filter: (this.props.platform || '').split('-')[0]
    };
  },

  renderPlatformList() {
    let {tab} = this.state;

    const tabSubset = flattenedPlatforms.filter(
      platform => tab === 'All' || categoryLists[tab].includes(platform.id)
    );

    let subsetMatch = ({id}) => id.includes(this.state.filter.toLowerCase());

    let filtered = tabSubset.filter(subsetMatch);

    if (this.state.filter) {
      filtered = flattenedPlatforms.filter(subsetMatch);
    }

    if (!this.props.showOther) {
      filtered = filtered.filter(({id}) => id !== 'other');
    }

    if (!filtered.length) {
      return (
        <p>
          {t(
            "Not finding your platform? There's a rich ecosystem of community supported SDKs as well (including Perl, CFML, Clojure, and ActionScript).\n Try searching for Sentry clients or contacting support."
          )}
        </p>
      );
    }

    return (
      <ul className="client-platform-list platform-tiles">
        {filtered.map((platform, idx) => {
          return (
            <PlatformCard
              platform={platform.id}
              className={classnames({
                selected: this.props.platform === platform.id
              })}
              key={platform.id}
              onClick={() => {
                this.props.setPlatform(platform.id);
              }}
            />
          );
        })}
      </ul>
    );
  },

  render() {
    let {filter} = this.state;
    return (
      <div className="platform-picker">
        <ul className="nav nav-tabs">
          <li style={{float: 'right', marginRight: 0}}>
            <div className="platform-filter-container">
              <span className="icon icon-search" />
              <input
                type="text"
                value={this.state.filter}
                className="platform-filter"
                label="Filter"
                placeholder="Filter"
                onChange={e => this.setState({filter: e.target.value})}
              />
            </div>
          </li>
          {categoryList.map(categoryName => {
            return (
              <ListLink
                key={categoryName}
                onClick={e => {
                  this.setState({tab: categoryName, filter: ''});
                  e.preventDefault();
                }}
                to={''}
                isActive={() => categoryName === (filter ? 'All' : this.state.tab)}>
                {categoryName}
              </ListLink>
            );
          })}
        </ul>
        {this.renderPlatformList()}
      </div>
    );
  }
});

export default PlatformPicker;
