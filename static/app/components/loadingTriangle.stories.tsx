import LoadingTriangle from 'sentry/components/loadingTriangle';
import * as Storybook from 'sentry/stories';

export default Storybook.story('LoadingTriangle', story => {
  story('Default', () => (
    <Storybook.SizingWindow style={{height: '150px'}}>
      <LoadingTriangle />
    </Storybook.SizingWindow>
  ));

  story('With children', () => (
    <Storybook.SizingWindow style={{height: '190px'}}>
      <LoadingTriangle>This will take a while...</LoadingTriangle>
    </Storybook.SizingWindow>
  ));
});
