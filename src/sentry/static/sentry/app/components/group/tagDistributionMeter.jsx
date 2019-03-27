import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

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
    organization: SentryTypes.Organization.isRequired,
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
    const {organization, projectId, group, totalValues, topValues, tag} = this.props;
    const hasSentry10 = new Set(organization.features).has('sentry10');

    const totalVisible = topValues.reduce((sum, value) => sum + value.count, 0);
    const hasOther = totalVisible < totalValues;
    const otherPct = percent(totalValues - totalVisible, totalValues);
    const otherPctLabel = Math.floor(otherPct);
    const url = hasSentry10
      ? `/organizations/${organization.slug}/issues/${group.id}/tags/${tag}/`
      : `/${organization.slug}/${projectId}/issues/${group.id}/tags/${tag}/`;

    return (
      <React.Fragment>
        {topValues.map((value, index) => {
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);

          const tooltipHtml =
            '<div class="truncate">' +
            escape(deviceNameMapper(value.name || '', this.state.iOSDeviceList) || '') +
            '</div>' +
            pctLabel +
            '%';

          return (
            <Tooltip key={value.value} title={tooltipHtml} tooltipOptions={{html: true}}>
              <Segment
                style={{width: pct + '%'}}
                to={url}
                index={index}
                first={index == 0}
                last={!hasOther && index == topValues.length - 1}
              >
                <Description first={index == 0}>
                  <Percentage>{pctLabel}%</Percentage>
                  <Label>
                    <DeviceName>{value.name}</DeviceName>
                  </Label>
                </Description>
              </Segment>
            </Tooltip>
          );
        })}
        {hasOther && (
          <Tooltip
            key="other"
            title={`Other<br/>${otherPctLabel}%`}
            tooltipOptions={{html: true}}
          >
            <Segment
              index={9}
              first={!topValues.length}
              last={true}
              css={{width: otherPct + '%'}}
              to={url}
            >
              <Description first={!topValues.length}>
                <Percentage>{otherPctLabel}%</Percentage>
                <Label>{t('Other')}</Label>
              </Description>
            </Segment>
          </Tooltip>
        )}
      </React.Fragment>
    );
  },

  renderBody() {
    if (this.state.loading || this.state.error) {
      return null;
    }

    if (!this.props.totalValues) {
      return <p>{t('No recent data.')}</p>;
    }

    return this.renderSegments();
  },

  render() {
    return (
      <DistributionGraph>
        <Tag>{this.props.tag}</Tag>
        {this.renderBody()}
      </DistributionGraph>
    );
  },
});

const DistributionGraph = styled('div')`
  position: relative;
  font-size: 13px;
  margin-bottom: 10px;
`;

const Tag = styled('div')`
  position: relative;
  font-size: 13px;
  margin: 10px 0 8px;
  font-weight: bold;
  z-index: 5;
  line-height: 1;
`;

const Description = styled('span', {shouldForwardProp: isPropValid})`
  background-color: #fff;
  position: absolute;
  text-align: right;
  top: -1px;
  right: 0;
  line-height: 1;
  z-index: 1;
  width: 100%;
  display: ${p => (p.first ? 'block' : 'none')};

  &:hover {
    display: block;
    z-index: 2;
  }
`;

const Percentage = styled('span')`
  margin-right: 6px;
  color: ${p => p.theme.gray2};
  display: inline-block;
  vertical-align: middle;
`;

const Label = styled('span')`
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 45%;
  vertical-align: middle;
`;

const getColor = p => {
  return [
    '#7c7484',
    '#867f90',
    '#918a9b',
    '#9b96a7',
    '#a6a1b3',
    '#b0acbe',
    '#bbb7ca',
    '#c5c3d6',
    '#d0cee1',
    '#dad9ed',
  ][p.index];
};

const Segment = styled(Link, {shouldForwardProp: isPropValid})`
  height: 16px;
  display: inline-block;
  color: inherit;

  &:hover {
    background: ${p => p.theme.purple};
  }

  border-top-left-radius: ${p => p.first && p.theme.borderRadius};
  border-bottom-left-radius: ${p => p.first && p.theme.borderRadius};

  border-top-right-radius: ${p => p.last && p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.last && p.theme.borderRadius};

  background-color: ${getColor};
`;

export {TagDistributionMeter};
export default withEnvironment(TagDistributionMeter);
