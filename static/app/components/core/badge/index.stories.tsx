import Badge from 'sentry/components/core/badge';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Badge', story => {
  story('Default', () => (
    <SideBySide>
      <Badge text="Text Prop" />
      <Badge>
        Using <JSXProperty name="children" value="" />
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
      <Badge type="gray">Gray</Badge>
    </SideBySide>
  ));
});
