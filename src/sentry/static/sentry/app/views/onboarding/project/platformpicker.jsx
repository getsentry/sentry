import PropTypes from 'prop-types';
import React from 'react';
import classnames from 'classnames';
import _ from 'lodash';

import analytics from 'app/utils/analytics';
import ListLink from 'app/components/listLink';
import {flattenedPlatforms, categoryList} from 'app/views/onboarding/utils';
import PlatformCard from 'app/views/onboarding/project/platformCard';
import {t} from 'app/locale';

const allCategories = categoryList.concat({id: 'all', name: t('All')});

class PlatformPicker extends React.Component {
  static propTypes = {
    setPlatform: PropTypes.func.isRequired,
    platform: PropTypes.string,
    showOther: PropTypes.bool,
  };

  static defaultProps = {showOther: true};

  constructor(...args) {
    super(...args);
    this.state = {
      tab: allCategories[0].id,
      filter: (this.props.platform || '').split('-')[0],
    };
  }

  logSearch = _.debounce(() => {
    if (this.state.filter) {
      analytics('platformpicker.search', {
        query: this.state.filter.toLowerCase(),
        num_results: this.getPlatformList().length,
      });
    }
  }, 300);

  getPlatformList = () => {
    let subsetMatch = ({id}) => id.includes(this.state.filter.toLowerCase());
    let filtered;

    if (this.state.filter) {
      filtered = flattenedPlatforms.filter(subsetMatch);
    } else {
      let {tab} = this.state;
      const currentCategory = categoryList.find(({id}) => id === tab);
      const tabSubset = flattenedPlatforms.filter(platform => {
        return tab === 'all' || currentCategory.platforms.includes(platform.id);
      });
      filtered = tabSubset.filter(subsetMatch);
    }

    if (!this.props.showOther) {
      filtered = filtered.filter(({id}) => id !== 'other');
    }

    return filtered;
  };

  render() {
    let {filter} = this.state;
    let filtered = this.getPlatformList();
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
                label={t('Filter')}
                placeholder="Filter"
                onChange={e => this.setState({filter: e.target.value}, this.logSearch)}
              />
            </div>
          </li>
          {allCategories.map(({id, name}) => {
            return (
              <ListLink
                key={id}
                onClick={e => {
                  analytics('platformpicker.select_tab', {tab: id});
                  this.setState({tab: id, filter: ''});
                  e.preventDefault();
                }}
                to={''}
                isActive={() => id === (filter ? 'all' : this.state.tab)}
              >
                {name}
              </ListLink>
            );
          })}
        </ul>
        {filtered.length ? (
          <ul className="client-platform-list platform-tiles">
            {filtered.map((platform, idx) => {
              return (
                <PlatformCard
                  platform={platform.id}
                  className={classnames({
                    selected: this.props.platform === platform.id,
                  })}
                  key={platform.id}
                  onClick={e => {
                    analytics('platformpicker.select_platform', {platform: platform.id});
                    this.props.setPlatform(platform.id);
                    e.preventDefault();
                  }}
                />
              );
            })}
          </ul>
        ) : (
          <p>
            {t(
              "Not finding your platform? There's a rich ecosystem of community supported SDKs as well (including Perl, CFML, Clojure, and ActionScript).\n Try searching for Sentry clients or contacting support."
            )}
          </p>
        )}
      </div>
    );
  }
}

export default PlatformPicker;
