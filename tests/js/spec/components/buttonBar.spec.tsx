import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';

describe('ButtonBar', function () {
  const createWrapper = () =>
    mountWithTheme(
      <ButtonBar active="2" merged>
        <Button barId="1">First Button</Button>
        <Button barId="2">Second Button</Button>
        <Button barId="3">Third Button</Button>
        <Button barId="4">Fourth Button</Button>
      </ButtonBar>
    );

  it('has "Second Button" as the active button in the bar', function () {
    const {getByLabelText} = createWrapper();
    expect(getByLabelText('First Button')).not.toHaveClass('active');
    expect(getByLabelText('Second Button')).toHaveClass('active');
  });
});
