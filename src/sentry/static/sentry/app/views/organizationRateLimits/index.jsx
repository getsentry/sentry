import PropTypes from 'prop-types';
import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import OrganizationState from '../../mixins/organizationState';
import {RangeField} from '../../components/forms';
import {t} from '../../locale';

const AccountLimit = React.createClass({
  propTypes: {
    value: PropTypes.number,
    onChange: PropTypes.func.isRequired
  },

  getRateLimitValues() {
    let steps = [];
    let i = 0;
    while (i <= 1000000) {
      steps.push(i);
      if (i < 10000) {
        i += 1000;
      } else if (i < 100000) {
        i += 10000;
      } else {
        i += 100000;
      }
    }
    return steps;
  },

  render() {
    return (
      <RangeField
        name="accountLimit"
        min={0}
        max={1000000}
        value={this.props.value}
        allowedValues={this.getRateLimitValues()}
        help="The maximum number of events to accept across this entire organization."
        placeholder="e.g. 500"
        onChange={this.props.onChange}
        inputClassName="col-md-3"
        formatLabel={value => {
          return !value ? 'No Limit' : `${value.toLocaleString()} per hour`;
        }}
      />
    );
  }
});

const RateLimitEditor = React.createClass({
  propTypes: {
    organization: PropTypes.object.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    let projectLimit = this.props.organization.quota.projectLimit;
    let accountLimit = this.props.organization.quota.accountLimit;

    return {
      activeNav: 'rate-limits',
      currentProjectLimit: projectLimit,
      savedProjectLimit: projectLimit,
      currentAccountLimit: accountLimit,
      savedAccountLimit: accountLimit,
      saving: false
    };
  },

  onProjectLimitChange(value) {
    this.setState({
      currentProjectLimit: value
    });
  },

  onAccountLimitChange(value) {
    this.setState({
      currentAccountLimit: value
    });
  },

  onSubmit(e) {
    e.preventDefault();

    let loadingIndicator = IndicatorStore.add(t('Saving..'));

    this.setState(
      {
        saving: true,
        error: false
      },
      () => {
        this.api.request(`/organizations/${this.props.organization.slug}/`, {
          method: 'PUT',
          data: {
            projectRateLimit: this.state.currentProjectLimit,
            accountRateLimit: this.state.currentAccountLimit
          },
          success: data => {
            // TODO(dcramer): propagate this change correctly (how??)
            IndicatorStore.remove(loadingIndicator);
            this.props.organization.quota = data.quota;
            this.setState({
              saving: false,
              savedProjectLimit: data.quota.projectLimit,
              savedAccountLimit: data.quota.accountLimit
            });
          },
          error: () => {
            this.setState({saving: false});
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error', {
              duration: 3000
            });
          }
        });
      }
    );
  },

  render() {
    let {
      currentProjectLimit,
      savedProjectLimit,
      currentAccountLimit,
      savedAccountLimit,
      saving
    } = this.state;
    let {maxRate, maxRateInterval} = this.props.organization.quota;
    let canSave =
      (savedProjectLimit !== currentProjectLimit ||
        savedAccountLimit !== currentAccountLimit) &&
      !saving;

    return (
      <form onSubmit={this.onSubmit} className="ref-rate-limit-editor">
        <p>
          Rate limits allow you to control how much data is stored for this organization. When a rate is exceeded the system will begin discarding data until the next interval.
        </p>

        <h5>Account Limit</h5>

        {!maxRate
          ? <AccountLimit
              value={currentAccountLimit}
              onChange={this.onAccountLimitChange}
            />
          : <p>
              Your account is limited to a maximum of
              {' '}
              {maxRate}
              {' '}
              events per
              {' '}
              {maxRateInterval}
              {' '}
              seconds.
            </p>}

        <h5>Per-Project Limit</h5>

        <RangeField
          name="projectLimit"
          value={savedProjectLimit || 100}
          onChange={this.onProjectLimitChange}
          step={5}
          min={50}
          max={100}
          formatLabel={value => {
            return value !== 100 ? `${value}%` : 'No Limit &mdash; 100%';
          }}
        />

        <div className="help-block">
          {t(
            'The maximum percentage of your account limit an individual project can consume.'
          )}
        </div>

        <div className="form-actions" style={{marginTop: 25}}>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            {t('Apply Changes')}
          </button>
        </div>
      </form>
    );
  }
});

const OrganizationRateLimits = React.createClass({
  mixins: [OrganizationState],

  render() {
    if (!this.context.organization) return null;

    let org = this.context.organization;

    return (
      <OrganizationHomeContainer>
        <div className="box">
          <div className="box-header">
            <h3>{t('Rate Limits')}</h3>
          </div>
          <div className="box-content with-padding">
            <RateLimitEditor organization={org} />
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationRateLimits;
