import LoadingIndicator from 'sentry/components/loadingIndicator';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LoadingIndicator', story => {
  story('Default', () => (
    <div>
      <p>
        Setting custom size on <JSXProperty name="size" value={24} /> will cause the
        border width to scale proportionally with the size of the loading indicator.
      </p>
      <SideBySide>
        <LoadingIndicator />
        <LoadingIndicator size={48} />
        <LoadingIndicator size={24} />
      </SideBySide>
    </div>
  ));

  story('Loading text', () => <LoadingIndicator>Loading...</LoadingIndicator>);
});
