import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import ApiMixin from 'app/mixins/apiMixin';
import SentryTypes from 'app/proptypes';
import Tooltip from 'app/components/tooltip';
import {escape, percent, deviceNameMapper} from 'app/utils';
import {t} from 'app/locale';
import withEnvironment from 'app/utils/withEnvironment';

const TagDistributionMeter = createReactClass({
  displayName: 'TagDistributionMeter',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    tag: PropTypes.string.isRequired,
    name: PropTypes.string,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null,
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
      this.props.name !== nextProps.name ||
      this.props.environment !== nextProps.environment
    );
  },

  componentDidUpdate(prevProps) {
    if (prevProps.environment !== this.props.environment) {
      this.fetchData();
    }
  },

  fetchData() {
    const {group, tag, environment} = this.props;
    const url = `/issues/${group.id}/tags/${encodeURIComponent(tag)}/`;
    const query = environment ? {environment: environment.name} : {};

    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(url, {
      query,
      success: data => {
        this.setState({
          data,
          error: false,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
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
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);
          const className = 'segment segment-' + index;

          const tooltipHtml =
            '<div class="truncate">' +
            escape(deviceNameMapper(value.name) || '') +
            '</div>' +
            pctLabel +
            '%';

          return (
            <Tooltip key={value.id} title={tooltipHtml} tooltipOptions={{html: true}}>
              <Link
                className={className}
                style={{width: pct + '%'}}
                to={`/${orgId}/${projectId}/issues/${this.props.group.id}/tags/${this
                  .props.tag}/`}
              >
                <span className="tag-description">
                  <span className="tag-percentage">{pctLabel}%</span>
                  <span className="tag-label">{deviceNameMapper(value.name)}</span>
                </span>
              </Link>
            </Tooltip>
          );
        })}
        {hasOther && (
          <Link
            key="other"
            className="segment segment-9"
            style={{width: otherPct + '%'}}
            to={`/${orgId}/${projectId}/issues/${this.props.group.id}/tags/${this.props
              .tag}/`}
            title={'Other<br/>' + otherPctLabel + '%'}
          >
            <span className="tag-description">
              <span className="tag-percentage">{otherPctLabel}%</span>
              <span className="tag-label">{t('Other')}</span>
            </span>
          </Link>
        )}
      </div>
    );
  },

  renderBody() {
    if (this.state.loading || this.state.error) return null;

    if (!this.state.data.totalValues) return <p>{t('No recent data.')}</p>;

    return this.renderSegments();
  },

  render() {
    return (
      <div className="distribution-graph">
        <h6>
          <span>{this.props.tag}</span>
        </h6>
        {this.renderBody()}
      </div>
    );
  },
});

export {TagDistributionMeter};
export default withEnvironment(TagDistributionMeter);
