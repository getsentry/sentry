import LoadingIndicator from 'sentry/components/loadingIndicator';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LoadingIndicator', story => {
  story('Default', () => <LoadingIndicator />);

  story('Mini', () => <LoadingIndicator mini />);

  story('With Message', () => <LoadingIndicator>Loading...</LoadingIndicator>);
});
