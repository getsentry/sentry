import PropTypes from 'prop-types';
import React from 'react';
import GroupEventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/proptypes';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Breadcrumb from 'app/components/events/interfaces/breadcrumbs/breadcrumb';
import {t, tct} from 'app/locale';

function Collapsed(props) {
  return (
    <li className="crumbs-collapsed">
      <span className="icon-container">
        <span className="icon icon-ellipsis" />
      </span>
      <a onClick={props.onClick}>
        {tct('Show [count] collapsed crumbs', {count: props.count})}
      </a>
    </li>
  );
}

function moduleToCategory(module) {
  if (!module) {
    return null;
  }
  let match = module.match(/^.*\/(.*?)(:\d+)/);
  if (match) {
    return match[1];
  }
  return module.split(/./)[0];
}

Collapsed.propTypes = {
  onClick: PropTypes.func.isRequired,
  count: PropTypes.number.isRequired,
};

class BreadcrumbsInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  static MAX_CRUMBS_WHEN_COLLAPSED = 10;

  constructor(...args) {
    super(...args);
    this.state = {
      collapsed: true,
      queryValue: '',
    };
  }

  onCollapseToggle = () => {
    this.setState({
      collapsed: !this.state.collapsed,
    });
  };

  renderBreadcrumbs = crumbs => {
    // reverse array to get consistent idx between collapsed/expanded state
    // (indexes begin and increment from last breadcrumb)
    return crumbs
      .reverse()
      .map((item, idx) => {
        return <Breadcrumb key={idx} crumb={item} />;
      })
      .reverse(); // un-reverse rendered result
  };

  renderNoMatch = () => {
    return (
      <li className="crumb-empty">
        <p>
          <span className="icon icon-exclamation" />{' '}
          {t('Sorry, no breadcrumbs match your search query.')}
        </p>
      </li>
    );
  };

  getVirtualCrumb = () => {
    let evt = this.props.event;
    let crumb;

    let exception = evt.entries.find(entry => entry.type === 'exception');
    if (exception) {
      let {type, value, module} = exception.data.values[0];
      crumb = {
        type: 'error',
        level: 'error',
        category: moduleToCategory(module || null) || 'exception',
        data: {
          type,
          value,
        },
      };
    } else if (evt.message) {
      let levelTag = (evt.tags || []).find(tag => tag.key === 'level');
      let level = levelTag && levelTag.value;
      crumb = {
        type: 'message',
        level,
        category: 'message',
        message: evt.message,
      };
    }

    if (crumb) {
      Object.assign(crumb, {
        timestamp: evt.dateCreated,
        last: true,
      });
    }

    return crumb;
  };

  setQuery = evt => {
    this.setState({
      queryValue: evt.target.value,
    });
  };

  filterCrumbs = (crumbs, queryValue) => {
    return crumbs.filter(item => {
      // return true if any of category, message, or level contain queryValue
      return !!['category', 'message', 'level'].find(prop => {
        let propValue = (item[prop] || '').toLowerCase();
        return propValue.includes(queryValue);
      });
    });
  };

  clearSearch = () => {
    this.setState({
      queryValue: '',
      collapsed: true,
    });
  };

  getSearchField = () => {
    return (
      <div className="breadcrumb-filter">
        <input
          type="text"
          className="search-input form-control"
          placeholder={t('Search breadcrumbs...')}
          autoComplete="off"
          value={this.state.queryValue}
          onChange={this.setQuery}
        />
        <span className="icon-search" />
        {this.state.queryValue && (
          <div>
            <a className="search-clear-form" onClick={this.clearSearch}>
              <span className="icon-circle-cross" />
            </a>
          </div>
        )}
      </div>
    );
  };

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let data = this.props.data;

    let title = (
      <div>
        <GuideAnchor target="breadcrumbs" type="text" />
        <h3>
          <strong>{t('Breadcrumbs')}</strong>
        </h3>
        {this.getSearchField()}
      </div>
    );

    let all = data.values;

    // Add the error event as the final (virtual) breadcrumb
    let virtualCrumb = this.getVirtualCrumb();
    if (virtualCrumb) {
      // make copy of values array / don't mutate props
      all = all.slice(0).concat([virtualCrumb]);
    }

    // filter breadcrumbs on text input
    let {queryValue} = this.state;
    let filtered = queryValue ? this.filterCrumbs(all, queryValue.toLowerCase()) : all;

    // cap max number of breadcrumbs to show
    const MAX = BreadcrumbsInterface.MAX_CRUMBS_WHEN_COLLAPSED;
    let crumbs = filtered;
    if (this.state.collapsed && filtered.length > MAX) {
      crumbs = filtered.slice(-MAX);
    }

    let numCollapsed = filtered.length - crumbs.length;

    let crumbContent;
    if (crumbs.length) {
      crumbContent = this.renderBreadcrumbs(crumbs);
    } else if (all.length) {
      crumbContent = this.renderNoMatch();
    }
    return (
      <GroupEventDataSection
        className="breadcrumb-box"
        group={group}
        event={evt}
        type={this.props.type}
        title={title}
        wrapTitle={false}
      >
        <ul className="crumbs">
          {numCollapsed > 0 && (
            <Collapsed onClick={this.onCollapseToggle} count={numCollapsed} />
          )}
          {crumbContent}
        </ul>
      </GroupEventDataSection>
    );
  }
}

export default BreadcrumbsInterface;
