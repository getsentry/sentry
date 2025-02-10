import ProgressBar from 'sentry/components/progressBar';
import Matrix from 'sentry/components/stories/matrix';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('ProgressBar', story => {
  story('Default', () => (
    <Matrix
      propMatrix={{
        value: [0, 25, 50, 75, 100],
        variant: ['small', 'large'],
      }}
      render={ProgressBar}
      selectedProps={['value', 'variant']}
    />
  ));
});
