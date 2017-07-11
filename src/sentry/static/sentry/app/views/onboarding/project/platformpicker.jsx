import React from 'react';
import ListLink from '../../../components/listLink';
import classnames from 'classnames';
// import {platforms} from '../../../../../../integration-docs/_platforms.json';
import {flattenedPlatforms} from '../utils';
import PlatformiconTile from './platformiconTile';

const categoryList = ['Popular', 'Frontend', 'Backend', 'Mobile', 'All'];

const languages = flattenedPlatforms.filter(p => p.type === 'language');

const PlatFormPicker = React.createClass({
  propTypes: {
    setPlatform: React.PropTypes.func,
    platform: React.PropTypes.string
  },

  getInitialState() {
    return {
      tab: categoryList[4],
      filter: ''
    };
  },

  renderPlatformList() {
    const filtered = flattenedPlatforms.filter(platform => {
      return (platform.id + ' ' + platform.platform).includes(this.state.filter);
    });
    return (
      <ul className="client-platform-list platform-tiles">
        {filtered.map((platform, idx) => {
          return (
            <PlatformiconTile
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

  renderLanguageList() {
    const filtered = languages.filter(platform => {
      return (platform.id + ' ' + platform.platform).includes(this.state.filter);
    });
    return (
      <ul className="client-platform-list platform-tiles">
        {filtered.map((platform, idx) => {
          return (
            <PlatformiconTile
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

  renderExtended() {
    if (!this.props.platform) return false;

    const language = this.props.platform.split('-')[0];

    const variants = flattenedPlatforms.filter(i => i.language === language);
    const filtered = variants.filter(platform => {
      return (platform.id + ' ' + platform.platform).includes(this.state.filter);
    });

    return (
      <ul className="client-platform-list platform-tiles">
        {filtered.map((platform, idx) => {
          return (
            <PlatformiconTile
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
          <li>
            <span className="icon icon-search" />
            <input
              type="text"
              className="platform-filter"
              label="Filter"
              placeholder="Filter"
              onChange={e => this.setState({filter: e.target.value})}
            />
          </li>
        </ul>
        {this.renderLanguageList()}
        <hr />
        {this.renderExtended()}
        <hr />

      </div>
    );
  }
});

export default PlatFormPicker;
