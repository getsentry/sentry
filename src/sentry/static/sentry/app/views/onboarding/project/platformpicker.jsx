import React from 'react';
import ListLink from '../../../components/listLink';
import classnames from 'classnames';

import {flattenedPlatforms, categoryLists} from '../utils';
import PlatformCard from './platformCard';
import {t} from '../../../locale';

const categoryList = Object.keys(categoryLists).concat('All');

const PlatformPicker = React.createClass({
  propTypes: {
    setPlatform: React.PropTypes.func.isRequired,
    platform: React.PropTypes.string
  },

  getInitialState() {
    return {
      tab: categoryList[0],
      filter: ''
    };
  },

  renderPlatformList() {
    let {tab} = this.state;

    const tabSubset = flattenedPlatforms.filter(
      platform => tab === 'All' || categoryLists[tab].includes(platform.id)
    );

    let subsetMatch = ({id}) => id.includes(this.state.filter);

    let filtered = tabSubset.filter(subsetMatch);

    if (!filtered.length) {
      filtered = flattenedPlatforms.filter(subsetMatch);
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
    return (
      <div className="platform-picker">
        <ul className="nav nav-tabs">
          <li style={{float: 'right', marginRight: 0}}>
            <div className="platform-filter-container">
              <span className="icon icon-search" />
              <input
                type="text"
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
                  this.setState({tab: categoryName});
                  e.preventDefault();
                }}
                to={''}
                isActive={() => categoryName === this.state.tab}>
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
