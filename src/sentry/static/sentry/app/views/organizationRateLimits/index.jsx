import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import OrganizationState from '../../mixins/organizationState';
import {RangeField} from '../../components/forms';
import {t, tct} from '../../locale';

const RateLimitEditor = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    let projectLimit = this.props.organization.quota.projectLimit;

    return {
      activeNav: 'rate-limits',
      currentProjectLimit: projectLimit,
      savedProjectLimit: projectLimit,
    };
  },

  onProjectLimitChange(value) {
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
      <form onSubmit={this.onSubmit} className="ref-rate-limit-editor">
        <p>
          {/* This may not translate well to all languages since maxRate may affect plural form of "events per minute" */}
          {tct('Your organization is limited to [strong:[maxRate] events per minute]. When this rate is exceeded the system will begin discarding data until the next interval.',
            {
              strong: <strong/>,
              maxRate: maxRate
            }
          )}
        </p>

        <RangeField
            label={t('Max percentage a single project may send')}
            defaultValue={savedProjectLimit}
            onChange={this.onProjectLimitChange}
            formatLabel={(value) => { return `${value}%`; }} />

        <div className="help-block">{t('The maximum percentage of your quota an individual project can consume.')}</div>

        <div className="form-actions" style={{marginTop: 25}}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={canSave}>{t('Apply Changes')}</button>
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
            <h3>{t('Rate Limits')}</h3>
          </div>
          <div className="box-content with-padding">
            {maxRate !== 0 ?
              <RateLimitEditor organization={org} />
            :
              <p className="ref-no-rate-limits">{t('There are no rate limits configured for your organization.')}</p>
            }
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  },
});


export default OrganizationRateLimits;
