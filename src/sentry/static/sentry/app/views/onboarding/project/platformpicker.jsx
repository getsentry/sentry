import React from 'react';
import TextField from '../../../components/forms/textField';
import ListLink from '../../../components/listLink';
import classnames from 'classnames';
import {platforms} from '../../../../../../integration-docs/_platforms.json';
const categoryList = ['Popular', 'Frontend', 'Backend', 'Mobile', 'All'];

const flattened = [].concat(
  [],
  ...platforms.map(language => {
    return language.integrations.map(i => {
      return {...i, language: language.id};
    });
  })
);

const PlatFormPicker = React.createClass({
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
    const filtered = flattened.filter(platform => {
      return (platform.id + ' ' + platform.platform).includes(this.state.filter);
    });
    return (
      <ul className="client-platform-list platform-tiles">
        {filtered.map((platform, idx) => {
          return (
            <li
              className={classnames('platform-tile', platform.language, platform.id, {
                selected: this.props.platform === platform.id
              })}
              key={idx}
              onClick={() => {
                this.props.setPlatform(platform.id);
              }}>
              <span className={`platformicon platformicon-${platform.id}`} />
              {platform.name}
            </li>
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
            <TextField
              className="platform-filter"
              name="filter"
              placeholder="Filter"
              onChange={v => this.setState({filter: v})}
            />
          </li>
        </ul>
        {this.renderPlatformList()}
      </div>
    );
  }
});

export default PlatFormPicker;
