import SeenInfo from 'sentry/components/group/seenInfo';

export default {
  title: 'Features/Issues/Seen Info',
  args: {
    title: 'Last Seen',
  },
};

const organization = {
  slug: 'test-org',
};
const date = new Date();

export const Default = ({title}) => {
  return (
    <SeenInfo
      hasRelease={false}
      organization={organization}
      orgSlug="sentry-test"
      environment="prod"
      projectSlug="test-project"
      projectId="1"
      title={title}
      date={date}
      dateGlobal={date}
    />
  );
};

Default.storyName = 'Seen Info';
