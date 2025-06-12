import LoadingIndicator from 'sentry/components/loadingIndicator';
import * as Storybook from 'sentry/stories';

export default Storybook.story('LoadingIndicator', story => {
  story('Default', () => (
    <div>
      <p>
        Setting custom size on <Storybook.JSXProperty name="size" value={24} /> will cause
        the border width to scale proportionally with the size of the loading indicator.
      </p>
      <Storybook.SideBySide>
        <LoadingIndicator />
        <LoadingIndicator size={48} />
        <LoadingIndicator size={24} />
      </Storybook.SideBySide>
    </div>
  ));

  story('Loading text', () => <LoadingIndicator>Loading...</LoadingIndicator>);
});
