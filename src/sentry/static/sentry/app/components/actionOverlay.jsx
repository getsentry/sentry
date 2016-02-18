import React from 'react';
import {History} from 'react-router';
import OrganizationState from '../mixins/organizationState';
import {t} from '../locale';
import requiredAdminActions from '../components/requiredAdminActions';
import LoadingIndicator from '../components/loadingIndicator';

const ActionOverlay = React.createClass({
  propTypes: {
    actionId: React.PropTypes.string.isRequired,
    isLoading: React.PropTypes.bool
  },
  mixins: [OrganizationState, History],

  componentWillMount() {
    let action = this.getAction();
    if (!action.requiresAction(this.getOrganization())) {
      this.dismiss();
    }
  },

  getAction() {
    return requiredAdminActions[this.props.actionId];
  },

  dismiss() {
    // is this the right thing?
    this.context.history.goBack();
  },

  onDoThisLater(event) {
    event.preventDefault();
    this.dismiss();
  },

  render() {
    let {children, isLoading, ...other} = this.props;
    let orgUrl = `/organizations/${this.getOrganization().slug}/`;
    let className = 'admin-action-overlay';
    if (isLoading) {
      className += ' loading-data';
    }

    return (
      <div className={className} {...other}>
        <div className="pattern"/>
        <div className="container">
          <div className="dialog">
            <div className="dialog-contents">
              <div className="discard-bar">
                <a href={orgUrl} onClick={this.onDoThisLater}>{
                  t('Do this later …')}</a>
              </div>
              <div className="content">
                {children}
              </div>
              {isLoading ?
                <div className="loading-overlay">
                  <LoadingIndicator/>
                </div> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default ActionOverlay;
