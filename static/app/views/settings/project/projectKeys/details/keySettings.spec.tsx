import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

import {KeySettings} from './keySettings';
import {DynamicSDKLoaderOption, sdkLoaderOptions} from './loaderSettings';

describe('Key Settings', function () {
  it('renders Loader Script Settings', function () {
    const dynamicSdkLoaderOptions = {
      [DynamicSDKLoaderOption.HAS_PERFORMANCE]: false,
      [DynamicSDKLoaderOption.HAS_REPLAY]: true,
      [DynamicSDKLoaderOption.HAS_DEBUG]: false,
    };

    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
      },
      router: {
        params,
      },
    });

    const data = {
      ...(TestStubs.ProjectKeys()[0] as ProjectKey),
      dynamicSdkLoaderOptions,
    } as ProjectKey;

    render(
      <KeySettings
        data={data}
        onRemove={jest.fn()}
        organization={organization}
        params={params}
      />
    );

    // Panel title
    expect(screen.getByText('JavaScript Loader')).toBeInTheDocument();

    // SDK loader options
    for (const key of Object.keys(sdkLoaderOptions)) {
      expect(screen.getByText(sdkLoaderOptions[key].label)).toBeInTheDocument();
      const toggle = screen.getByRole('checkbox', {name: sdkLoaderOptions[key].label});
      expect(toggle).toBeEnabled();

      if (key === DynamicSDKLoaderOption.HAS_REPLAY) {
        expect(toggle).toBeChecked();
      } else {
        expect(toggle).not.toBeChecked();
      }
    }
  });
});
