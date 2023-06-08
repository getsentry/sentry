/* eslint-disable jest/no-disabled-tests */

import {render} from 'sentry-test/reactTestingLibrary';

import PluginIcon from 'sentry/plugins/components/pluginIcon';

// For some reason jest only respects the last mocked, so we can't test
// two different images here
// jest.mock('images/logos/logo-default.svg', () => 'default', {});
jest.mock('images/logos/logo-github.svg', () => 'github', {});

describe('PluginIcon', function () {
  it('renders', function () {
    const {container} = render(<PluginIcon pluginId="github" size={20} />);
    expect(container).toSnapshot();
  });

  // doesn't work because of the above comment
  it.skip('renders with default icon with invalid plugin id', function () {
    const {container} = render(<PluginIcon pluginId="invalid" size={20} />);
    expect(container).toSnapshot();
  });
});
