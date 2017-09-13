import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import Switch from '../../components/switch';
import marked from '../../utils/marked';

const LEGACY_BROWSER_SUBFILTERS = {
  ie_pre_9: {
    icon: 'internet-explorer',
    helpText: 'Version 8 and lower',
    title: 'Internet Explorer'
  },
  ie9: {
    icon: 'internet-explorer',
    helpText: 'Version 9',
    title: 'Internet Explorer'
  },
  ie10: {
    icon: 'internet-explorer',
    helpText: 'Version 10',
    title: 'Internet Explorer'
  },
  opera_pre_15: {
    icon: 'opera',
    helpText: 'Version 14 and lower',
    title: 'Opera'
  },
  safari_pre_6: {
    icon: 'safari',
    helpText: 'Version 5 and lower',
    title: 'Safari'
  },
  android_pre_4: {
    icon: 'android',
    helpText: 'Version 3 and lower',
    title: 'Android'
  }
};

const LEGACY_BROWSER_KEYS = Object.keys(LEGACY_BROWSER_SUBFILTERS);

const LegacyBrowserFilterRow = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired
  },

  getInitialState() {
    let initialSubfilters;
    if (this.props.data.active === true) {
      initialSubfilters = new Set(LEGACY_BROWSER_KEYS);
    } else if (this.props.data.active === false) {
      initialSubfilters = new Set();
    } else {
      initialSubfilters = new Set(this.props.data.active);
    }
    return {
      loading: false,
      error: false,
      subfilters: initialSubfilters
    };
  },

  onToggleSubfilters(subfilter) {
    let {subfilters} = this.state;

    if (subfilter === true) {
      subfilters = new Set(LEGACY_BROWSER_KEYS);
    } else if (subfilter === false) {
      subfilters = new Set();
    } else if (subfilters.has(subfilter)) {
      subfilters.delete(subfilter);
    } else {
      subfilters.add(subfilter);
    }

    this.setState(
      {
        subfilters: new Set(subfilters)
      },
      () => {
        this.props.onToggle(this.props.data, subfilters);
      }
    );
  },

  renderSubfilters() {
    let entries = LEGACY_BROWSER_KEYS.map(key => {
      let subfilter = LEGACY_BROWSER_SUBFILTERS[key];
      return (
        <div className="col-md-4" key={key}>
          <div className="filter-grid-item">
            <div className={'filter-grid-icon icon-' + subfilter.icon} />
            <h5>{subfilter.title}</h5>
            <p className="help-block">{subfilter.helpText}</p>
            <Switch
              isActive={this.state.subfilters.has(key)}
              toggle={this.onToggleSubfilters.bind(this, key)}
              size="lg"
            />
          </div>
        </div>
      );
    });

    // group entries into rows of 3
    let rows = _.groupBy(entries, (entry, i) => Math.floor(i / 3));

    return _.toArray(rows).map((row, i) => (
      <div className="row m-b-1" key={i}>{row}</div>
    ));
  },

  render() {
    let data = this.props.data;

    return (
      <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
        <div className="row">
          <div className="col-md-9">
            <h5 style={{marginBottom: 10}}>{data.name}</h5>
            {data.description &&
              <small
                className="help-block"
                dangerouslySetInnerHTML={{
                  __html: marked(data.description)
                }}
              />}
          </div>
          <div className="col-md-3 align-right">
            <div className="filter-grid-filter">
              <strong>Filter:</strong>
              <a onClick={this.onToggleSubfilters.bind(this, true)}>All</a>
              <span className="divider" />
              <a onClick={this.onToggleSubfilters.bind(this, false)}>None</a>
            </div>
          </div>
        </div>

        {this.renderSubfilters()}
      </div>
    );
  }
});

export default LegacyBrowserFilterRow;
