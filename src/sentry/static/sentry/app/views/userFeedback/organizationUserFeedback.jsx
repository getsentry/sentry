import React from 'react';

import UserFeedbackContainer from './container';

export default class OrganizationUserFeedback extends React.Component {
  renderList() {
    // TODO: implement this
  }

  render() {
    return (
      <UserFeedbackContainer location={this.props.location} pageLinks={''} status={''}>
        {this.renderList()}
      </UserFeedbackContainer>
    );
  }
}
