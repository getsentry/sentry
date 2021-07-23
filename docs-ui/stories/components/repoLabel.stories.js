import RepoLabel from 'app/components/repoLabel';

export default {
  title: 'Components/Tags/Repo Label',
};

export const Default = () => {
  return <RepoLabel>prod</RepoLabel>;
};

Default.storyName = 'Repo Label';
