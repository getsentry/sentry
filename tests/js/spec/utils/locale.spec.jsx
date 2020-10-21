import {mount} from 'sentry-test/enzyme';

import {tct} from 'app/locale';

describe('locale.gettextComponentTemplate', () => {
  it('should render two component templates inside the same parent', async () => {
    const wrapper = mount(
      <div>
        {tct('1st: [one]', {
          one: 'one',
        })}
        {tct('2nd: [two]', {
          two: 'two',
        })}
      </div>
    );
    await tick();
    wrapper.update();

    expect(wrapper.text()).toBe('1st: one2nd: two');
  });
});
