import Badge from 'sentry/components/badge';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Badge', story => {
  story('Default', () => (
    <SideBySide>
      <Badge text="Text Prop" />
      <Badge>
        Using <em>Children</em>
      </Badge>
    </SideBySide>
  ));

  story('Type', () => (
    <SideBySide>
      <Badge type="default">Default</Badge>
      <Badge type="alpha">Alpha</Badge>
      <Badge type="beta">Beta</Badge>
      <Badge type="new">New</Badge>
      <Badge type="experimental">Experimental</Badge>
      <Badge type="warning">Warning</Badge>
    </SideBySide>
  ));
});
