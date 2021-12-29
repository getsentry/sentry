import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import Tag from 'sentry/components/tagDeprecated';

describe('Tag', function () {
  it('renders', function () {
    const {container} = mountWithTheme(
      <Tag priority="info" border size="small">
        Text to Copy
      </Tag>
    );
    expect(container).toSnapshot();
  });
});
