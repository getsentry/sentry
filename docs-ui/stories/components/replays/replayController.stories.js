import ReplayController from 'sentry/components/replays/replayController';

export default {
  title: 'Components/Replays/ReplayController',
  component: ReplayController,
};

const Template = ({...args}) => <ReplayController {...args} />;

export const _ReplayController = Template.bind({});
_ReplayController.args = {};
_ReplayController.parameters = {
  docs: {
    description: {
      story:
        'ReplayController is a component that contains play/pause buttons for the replay timeline',
    },
  },
};
