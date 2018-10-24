import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {escape, percent} from 'app/utils';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import DeviceName, {
  deviceNameMapper,
  loadDeviceListModule,
} from 'app/components/deviceName';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
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
    totalValues: PropTypes.number,
    topValues: PropTypes.array,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
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
      this.props.environment !== nextProps.environment ||
      this.props.totalValues !== nextProps.totalValues ||
      this.props.topValues !== nextProps.topValues
    );
  },

  componentDidUpdate(prevProps) {
    if (prevProps.environment !== this.props.environment) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

      loadDeviceListModule()
      .then(iOSDeviceList => {
        this.setState({
          iOSDeviceList,
          error: false,
          loading: false,
        });
      })
      .catch(() => {
        this.setState({
          error: true,
          loading: false,
        });
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
    let {orgId, projectId, group, totalValues, topValues, tag} = this.props;

    let totalVisible = topValues.reduce((sum, value) => sum + value.count, 0);
    let hasOther = totalVisible < totalValues;
    let otherPct = percent(totalValues - totalVisible, totalValues);
    let otherPctLabel = Math.floor(otherPct);

    return (
      <div className="segments">
        {topValues.map((value, index) => {
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);
          const className = 'segment segment-' + index;

          const tooltipHtml =
            '<div class="truncate">' +
            escape(deviceNameMapper(value.name || '', this.state.iOSDeviceList) || '') +
            '</div>' +
            pctLabel +
            '%';

          return (
            <Tooltip key={value.key} title={tooltipHtml} tooltipOptions={{html: true}}>
              <Link
                className={className}
                style={{width: pct + '%'}}
                to={`/${orgId}/${projectId}/issues/${group.id}/tags/${tag}/`}
              >
                <span className="tag-description">
                  <span className="tag-percentage">{pctLabel}%</span>
                  <span className="tag-label">
                    <DeviceName>{value.name}</DeviceName>
                  </span>
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

    if (!this.props.totalValues) return <p>{t('No recent data.')}</p>;

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
