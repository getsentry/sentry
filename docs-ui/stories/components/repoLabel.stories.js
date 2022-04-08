import RepoLabel from 'sentry/components/repoLabel';

export default {
  title: 'Components/Tags/Repo Label',
};

export const Default = () => {
  return <RepoLabel>prod</RepoLabel>;
};

Default.storyName = 'Repo Label';
