import {mountWithTheme} from 'sentry-test/enzyme';

import Tag from 'app/components/tagDeprecated';

describe('Tag', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <Tag priority="info" border size="small">
        Text to Copy
      </Tag>
    );
    expect(wrapper).toSnapshot();
  });
});
