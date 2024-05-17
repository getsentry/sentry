import {render} from 'sentry-test/reactTestingLibrary';

import PluginIcon from 'sentry/plugins/components/pluginIcon';

// For some reason jest only respects the last mocked, so we can't test
// two different images here
// jest.mock('images/logos/logo-default.svg', () => 'default', {});
jest.mock('images/logos/logo-github.svg', () => 'github', {});

describe('PluginIcon', function () {
  it('renders', function () {
    render(<PluginIcon pluginId="github" size={20} />);
  });
});
