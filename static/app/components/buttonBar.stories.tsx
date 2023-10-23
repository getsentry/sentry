import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Matrix from 'sentry/components/stories/matrix';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(ButtonBar, story => {
  story('Default', () => (
    <ButtonBar>
      <Button>One</Button>
      <Button>Two</Button>
      <Button>Three</Button>
    </ButtonBar>
  ));

  story('Active', () => (
    <ButtonBar active="two">
      <Button barId="one">One</Button>
      <Button barId="two">Two</Button>
      <Button barId="three">Three</Button>
    </ButtonBar>
  ));

  story('Props', () => (
    <Matrix
      render={props => (
        <ButtonBar {...props}>
          <Button>One</Button>
          <Button>One</Button>
          <Button>One</Button>
        </ButtonBar>
      )}
      selectedProps={['gap', 'merged']}
      propMatrix={{
        merged: [true, false],
        gap: [0 as const, 2 as const],
      }}
    />
  ));
});
