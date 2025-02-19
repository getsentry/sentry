import LoadingTriangle from 'sentry/components/loadingTriangle';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LoadingTriangle', story => {
  story('Default', () => (
    <SizingWindow style={{height: '150px'}}>
      <LoadingTriangle />
    </SizingWindow>
  ));

  story('With children', () => (
    <SizingWindow style={{height: '190px'}}>
      <LoadingTriangle>This will take a while...</LoadingTriangle>
    </SizingWindow>
  ));
});
