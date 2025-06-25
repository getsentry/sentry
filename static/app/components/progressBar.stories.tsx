import ProgressBar from 'sentry/components/progressBar';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ProgressBar', story => {
  story('Default', () => (
    <Storybook.PropMatrix
      propMatrix={{
        value: [0, 25, 50, 75, 100],
        variant: ['small', 'large'],
      }}
      render={ProgressBar}
      selectedProps={['value', 'variant']}
    />
  ));
});
