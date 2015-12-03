import jQuery from 'jquery';
import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import OrganizationState from '../../mixins/organizationState';
import {t} from '../../locale';

const RangeInput = React.createClass({
  getDefaultProps() {
    return {
      min: 1,
      max: 100,
      step: 1,
      formatLabel: function(value) {
        return value;
      },
      onChange: function(e, value) {

      },
    };
  },

  getInitialState() {
    return {
      value: this.props.defaultValue,
    };
  },

  componentDidMount() {
    let {min, max, step} = this.props;
    let $value = jQuery('<span class="value" />');
    jQuery(this.refs.input).on('slider:ready', (e, data) => {
      $value.appendTo(data.el);
      $value.text(this.props.formatLabel(data.value));
      this.setState({
        value: data.value,
      });
    }).on('slider:changed', (e, data) => {
      $value.text(this.props.formatLabel(data.value));
      this.setState({
        value: data.value,
      });
      this.props.onChange(e, data.value);
    }).simpleSlider({
      range: [min, max],
      step: step,
      snap: true
    });
  },

  render() {
    let {min, max, step} = this.props;
    let {value} = this.state;
    return (
      <input type="range"
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          ref="input" />
    );
  },
});

const RateLimitEditor = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    let projectLimit = this.props.organization.quota.projectLimit;

    return {
      activeNav: 'rate-limits',
      currentProjectLimit: projectLimit,
      savedProjectLimit: projectLimit,
    };
  },

  onProjectLimitChange(e, value) {
    this.setState({
      currentProjectLimit: value,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    let loadingIndicator = IndicatorStore.add(t('Saving..'));

    this.setState({
      saving: true,
      error: false,
    }, () => {
      this.api.request(`/organizations/${this.props.organization.slug}/`, {
        method: 'PUT',
        data: {
          projectRateLimit: this.state.currentProjectLimit
        },
        success: (data) => {
          // TODO(dcramer): propagate this change correctly (how??)
          this.props.organization.quota = data.quota;
          this.setState({
            saving: false,
            savedProjectLimit: data.quota.projectLimit,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        },
      });
    });
  },

  render() {
    let {currentProjectLimit, savedProjectLimit, saving} = this.state;
    let maxRate = this.props.organization.quota.maxRate;
    let canSave = savedProjectLimit === currentProjectLimit && !saving;

    return (
      <form onSubmit={this.onSubmit}>
        <p>Your organization is limited to <strong>{maxRate} events per minute</strong>.
          When this rate is exceeded the system will begin discarding data until the
          next interval.</p>

        <p>You may set a limit to the maximum amount a single project may send:</p>

        <RangeInput
            defaultValue={savedProjectLimit}
            onChange={this.onProjectLimitChange}
            formatLabel={(value) => { return `${value}%`; }} />

        <div className="help-block">The maximum percentage of your quota an
          individual project can consume.</div>

        <div className="form-actions" style={{marginTop: 25}}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={canSave}>Apply Changes</button>
        </div>
      </form>
    );
  }
});

const OrganizationRateLimits = React.createClass({
  mixins: [OrganizationState],

  render() {
    if (!this.context.organization)
      return null;

    let org = this.context.organization;
    // TODO(dcramer): defined limit is only for testing atm
    let maxRate = org.quota.maxRate;

    return (
      <OrganizationHomeContainer>
        <div className="box">
          <div className="box-header">
            <h3>Rate Limits</h3>
          </div>
          <div className="box-content with-padding">
            {maxRate !== 0 ?
              <RateLimitEditor organization={org} />
            :
              <p>There are no rate limits configured for your organization.</p>
            }
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  },
});


export default OrganizationRateLimits;
