import {Component} from 'react';
import {action} from '@storybook/addon-actions';

import ShareIssue from 'sentry/views/organizationGroupDetails/actions/shareIssue';

export default {
  title: 'Features/Issues/Share Issue',
  component: ShareIssue,
  args: {
    shareUrl: 'https://sentry.io/share/issue/thisisanexampleshareurl/',
  },
  argTypes: {
    onReshare: {action: 'onReshare'},
    loading: {
      table: {
        disable: true,
      },
    },
    onToggle: {
      table: {
        disable: true,
      },
    },
    isShared: {
      table: {
        disable: true,
      },
    },
  },
};

class ShareSimulator extends Component {
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

export const Default = ({...args}) => {
  return (
    <ShareSimulator>
      {({isShared, loading, toggleShare}) => (
        <ShareIssue
          loading={loading}
          isShared={isShared}
          onToggle={toggleShare}
          {...args}
        />
      )}
    </ShareSimulator>
  );
};

Default.storyName = 'Share Issue';
