import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization, Project} from 'sentry/types';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

import {DynamicSDKLoaderOption, KeySettings, sdkLoaderOptions} from './keySettings';

const ORG_FEATURES = ['js-sdk-dynamic-loader'];

const dynamicSdkLoaderOptions = {
  [DynamicSDKLoaderOption.HAS_PERFORMANCE]: false,
  [DynamicSDKLoaderOption.HAS_REPLAY]: true,
  [DynamicSDKLoaderOption.HAS_DEBUG]: false,
};

function renderMockRequests(
  organizationSlug: Organization['slug'],
  projectSlug: Project['slug'],
  keyId: ProjectKey['id']
) {
  const projectKeys = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/keys/${keyId}/`,
    method: 'PUT',
    body: TestStubs.ProjectKeys()[0],
  });

  return {projectKeys};
}

describe('Key Settings', function () {
  describe('Dynamic SDK Loader', function () {
    it('renders default ui', async function () {
      const params = {
        projectId: '1',
        keyId: '1',
      };

      const {organization} = initializeOrg({
        ...initializeOrg(),
        organization: {
          ...initializeOrg().organization,
          features: ORG_FEATURES,
        },
        router: {
          params,
        },
      });

      const data = {
        ...(TestStubs.ProjectKeys()[0] as ProjectKey),
        dynamicSdkLoaderOptions,
      } as ProjectKey;

      const mockRequests = renderMockRequests(
        organization.slug,
        params.projectId,
        params.keyId
      );

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

      // Toggle performance option
      userEvent.click(
        screen.getByRole('checkbox', {
          name: sdkLoaderOptions[DynamicSDKLoaderOption.HAS_PERFORMANCE].label,
        })
      );

      await waitFor(() => {
        expect(mockRequests.projectKeys).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${params.projectId}/keys/${params.keyId}/`,
          expect.objectContaining({
            data: {
              dynamicSdkLoaderOptions: {
                ...dynamicSdkLoaderOptions,
                [DynamicSDKLoaderOption.HAS_PERFORMANCE]: true,
              },
            },
          })
        );
      });

      // Update SDK version
      await selectEvent.select(screen.getByText('latest'), '7.x');

      await waitFor(() => {
        expect(mockRequests.projectKeys).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${params.projectId}/keys/${params.keyId}/`,
          expect.objectContaining({
            data: {
              browserSdkVersion: '7.x',
            },
          })
        );
      });
    });
  });
});
