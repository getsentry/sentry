import React from 'react';
import ListLink from '../../../components/listLink';
import classnames from 'classnames';
// import {platforms} from '../../../../../../integration-docs/_platforms.json';
import {flattenedPlatforms, categoryLists} from '../utils';
import PlatformCard from './platformCard';

const categoryList = Object.keys(categoryLists).concat('All');
//  {'Popular', 'Frontend', 'Backend', 'Mobile', 'All'];

// const languages = flattenedPlatforms.filter(p => p.type === 'language');

const PlatformPicker = React.createClass({
  propTypes: {
    setPlatform: React.PropTypes.func,
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

    let subsetMatch = platform =>
      (platform.id + ' ' + platform.platform).includes(this.state.filter);

    let filtered = tabSubset.filter(subsetMatch);

    if (!filtered.length) {
      filtered = flattenedPlatforms.filter(subsetMatch);
    }

    if (!filtered.length) {
      return <p>Not finding your platform? we have a lot of community SDKs as well.</p>;
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
              key={idx}
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
          {categoryList.map(c => {
            return (
              <ListLink
                key={c}
                onClick={e => {
                  this.setState({tab: c});
                  e.preventDefault();
                }}
                to={''}
                isActive={() => c === this.state.tab}>
                {c}
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
