import Placeholder from 'sentry/components/placeholder';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Placeholder', story => {
  story('Basic', () => <Placeholder />);

  story('With Custom Dimensions', () => <Placeholder width="200px" height="100px" />);

  story('Circle Shape', () => <Placeholder shape="circle" width="80px" height="80px" />);

  story('With Content', () => (
    <Placeholder height="120px">
      <div>Loading content...</div>
    </Placeholder>
  ));

  story('Error State', () => <Placeholder error="Failed to load data" height="100px" />);

  story('With Bottom Gutter', () => (
    <div>
      <Placeholder bottomGutter={2} />
      <div>Content below placeholder</div>
    </div>
  ));

  story('Multiple Variations', () => (
    <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
      <Placeholder width="100px" height="60px" />
      <Placeholder shape="circle" width="60px" height="60px" />
      <Placeholder error="Error" width="120px" height="60px" />
      <Placeholder width="150px" height="60px">
        Custom content
      </Placeholder>
    </div>
  ));
});
