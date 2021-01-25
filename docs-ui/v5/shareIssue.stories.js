import React from 'react';
import {action} from '@storybook/addon-actions';

import ShareIssue from 'app/views/organizationGroupDetails/actions/shareIssue';

export default {
  title: 'Features/Issues/ShareIssue',
  component: ShareIssue,
  args: {
    shareUrl: 'https://sentry.io/share/issue/thisisanexampleshareurl/',
  },
  argTypes: {
    onReshare: {action: 'onReshare'},
  },
};

class ShareSimulator extends React.Component {
  state = {isShared: false, loading: false};
  toggleAction = action('Toggle');

  toggleShare() {
    this.toggleAction();
    this.setState({loading: true});

    // Simulate loading
    setTimeout(() => {
      this.setState(state => ({loading: false, isShared: !state.isShared}));
    }, 1000);
  }

  render() {
    return this.props.children({...this.state, toggleShare: () => this.toggleShare()});
  }
}

export const Default = ({shareUrl, onReshare}) => {
  return (
    <ShareSimulator>
      {({isShared, loading, toggleShare}) => (
        <ShareIssue
          loading={loading}
          isShared={isShared}
          shareUrl={shareUrl}
          onToggle={toggleShare}
          onReshare={onReshare}
        />
      )}
    </ShareSimulator>
  );
};

Default.storyName = 'ShareIssue';
