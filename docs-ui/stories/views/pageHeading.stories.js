import PageHeading from 'sentry/components/pageHeading';

export default {
  title: 'Views/Page Heading',
};

export const Default = () => <PageHeading withMargins>Page Header</PageHeading>;

Default.storyName = 'Page Heading';
