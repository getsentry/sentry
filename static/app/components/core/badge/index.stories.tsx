import Badge from 'sentry/components/core/badge';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import StoryBook from 'sentry/stories/storyBook';

export default StoryBook('Badge', Story => {
  Story('Default', () => (
    <Story.SideBySide>
      <Badge text="Text Prop" />
      <Badge>
        Using <JSXProperty name="children" value="" />
      </Badge>
    </Story.SideBySide>
  ));

  Story('Type', () => (
    <SideBySide>
      <Badge type="default">Default</Badge>
      <Badge type="alpha">Alpha</Badge>
      <Badge type="beta">Beta</Badge>
      <Badge type="new">New</Badge>
      <Badge type="experimental">Experimental</Badge>
      <Badge type="warning">Warning</Badge>
      <Badge type="gray">Gray</Badge>
    </SideBySide>
  ));
});
