import DeployBadge from 'sentry/components/deployBadge';

export default {
  title: 'Components/Badges/Deploy Badge',
  component: DeployBadge,
  args: {
    deploy: {
      name: '85fedddce5a61a58b160fa6b3d6a1a8451e94eb9 to prod',
      url: null,
      environment: 'production',
      dateStarted: null,
      dateFinished: '2020-05-11T18:12:00.025928Z',
      id: '6348842',
    },
  },
};

export const Default = ({deploy}) => (
  <div>
    <div>
      <DeployBadge deploy={deploy} orgSlug="sentry" version="1.2.3" />
    </div>
    <div>
      <DeployBadge
        deploy={{...deploy, environment: 'verylongenvironment'}}
        orgSlug="sentry"
        version="1.2.3"
      />
    </div>
    <div>
      <DeployBadge deploy={deploy} />
    </div>
  </div>
);

Default.storyName = 'Deploy Badge';
Default.parameters = {
  docs: {
    description: {
      story: 'Used to display deploy in a "badge"',
    },
  },
};
