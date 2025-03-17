import {render, screen} from 'sentry-test/reactTestingLibrary';

import ButtonBar from 'sentry/components/buttonBar';
import {Button} from 'sentry/components/core/button';

describe('ButtonBar', function () {
  const createWrapper = () =>
    render(
      <ButtonBar active="2" merged>
        <Button barId="1">First Button</Button>
        <Button barId="2">Second Button</Button>
        <Button barId="3">Third Button</Button>
        <Button barId="4">Fourth Button</Button>
      </ButtonBar>
    );

  it('has "Second Button" as the active button in the bar', function () {
    createWrapper();
    expect(screen.getByLabelText('First Button')).not.toHaveClass('active');
    expect(screen.getByLabelText('Second Button')).toHaveClass('active');
  });
});
