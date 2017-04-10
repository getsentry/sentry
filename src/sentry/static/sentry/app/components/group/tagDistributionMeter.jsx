import React from 'react';
import {Link} from 'react-router';
import ApiMixin from '../../mixins/apiMixin';
import PropTypes from '../../proptypes';
import TooltipMixin from '../../mixins/tooltip';
import {escape, percent, deviceNameMapper} from '../../utils';
import {t} from '../../locale';

const TagDistributionMeter = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    tag: React.PropTypes.string.isRequired,
    name: React.PropTypes.string,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      html: true,
      selector: '.segment',
      container: 'body'
    })
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.loading !== nextState.loading ||
      this.state.error !== nextState.error ||
      this.props.tag !== nextProps.tag ||
      this.props.name !== nextProps.name
    );
  },

  fetchData() {
    let url = '/issues/' + this.props.group.id + '/tags/' + encodeURIComponent(this.props.tag) + '/';

    this.setState({
      loading: true,
      error: false
    });

    this.api.request(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          data: data,
          error: false,
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  /**
   * Render segments of tag distribution
   *
   * e.g.
   *
   * .--------.-----.----------------.
   * |  web-1 |web-2|     other      |
   * `--------'-----'----------------'
   */

  renderSegments() {
    let data = this.state.data;
    let totalValues = data.totalValues;

    let totalVisible = data.topValues.reduce((sum, value) => sum + value.count, 0);

    let hasOther = totalVisible < totalValues;
    let otherPct = percent(totalValues - totalVisible, totalValues);
    let otherPctLabel = Math.floor(otherPct);

    let {orgId, projectId} = this.props;
    return (
      <div className="segments">
        {data.topValues.map((value, index) => {
          let pct = percent(value.count, totalValues);
          let pctLabel = Math.floor(pct);
          let className = 'segment segment-' + index;

          return (
            <Link
                key={value.id}
                className={className} style={{width: pct + '%'}}
                to={`/${orgId}/${projectId}/issues/${this.props.group.id}/tags/${this.props.tag}/`}
                title={'<div class="truncate">' + escape(deviceNameMapper(value.name)) + '</div>' + pctLabel + '%'}>
              <span className="tag-description">
                <span className="tag-percentage">{pctLabel}%</span>
                <span className="tag-label">{deviceNameMapper(value.name)}</span>
              </span>
            </Link>
          );
        })}
        {hasOther &&
          <Link
              key="other"
              className="segment segment-9" style={{width: otherPct + '%'}}
              to={`/${orgId}/${projectId}/issues/${this.props.group.id}/tags/${this.props.tag}/`}
              title={'Other<br/>' + otherPctLabel + '%'}>
            <span className="tag-description">
              <span className="tag-percentage">{otherPctLabel}%</span>
              <span className="tag-label">{t('Other')}</span>
            </span>
          </Link>
        }
      </div>
    );
  },

  renderBody() {
    if (this.state.loading || this.state.error)
      return null;

    if (!this.state.data.totalValues)
      return <p>{t('No recent data.')}</p>;

    return this.renderSegments();
  },


  render() {
    return (
      <div className="distribution-graph">
        <h6><span>{this.props.tag}</span></h6>
        {this.renderBody()}
      </div>
    );
  }
});

export default TagDistributionMeter;
