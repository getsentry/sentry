import {mountWithTheme} from 'sentry-test/enzyme';

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
    const wrapper = createWrapper();
    expect(wrapper.find('Button').at(1).prop('priority')).toBe('primary');
  });

  it('does not pass `barId` down to the button', function () {
    const wrapper = createWrapper();
    expect(wrapper.find('Button').at(1).prop('barId')).toBeUndefined();
  });
});
