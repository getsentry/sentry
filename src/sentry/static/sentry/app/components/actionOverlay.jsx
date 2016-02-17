import React from 'react';
import {History} from 'react-router';
import OrganizationState from '../mixins/organizationState';
import {t} from '../locale';

const ActionOverlay = React.createClass({
  propTypes: {
    actionId: React.PropTypes.string.isRequired
  },
  mixins: [OrganizationState, History],

  componentWillMount() {
    // in case we mount but we are not an org admin or our action is not
    // in the list of currently required actions, we bail out in a really
    // stupid way but works.
    let org = this.getOrganization();
    let access = this.getAccess();
    let requiredActions = new Set(org.requiredAdminActions);

    if (!access.has('org:write') ||
        !requiredActions.has(this.props.actionId)) {
      this.dismiss();
    }
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
    let {children, ...other} = this.props;
    let orgUrl = `/organizations/${this.getOrganization().slug}/`;
    return (
      <div className="admin-action-overlay" {...other}>
        <div className="pattern"/>
        <div className="container">
          <div className="dialog">
            <div className="discard-bar">
              <a href={orgUrl} onClick={this.onDoThisLater}>{
                t('Do this later …')}</a>
            </div>
            <div className="content">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default ActionOverlay;
