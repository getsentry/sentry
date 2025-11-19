import {AppSizeApiResponse, TreemapType} from 'sentry/views/preprod/types/appSizeTypes';
import {
  BuildDetailsApiResponse,
  BuildDetailsSizeAnalysisState,
  BuildDetailsState,
} from 'sentry/views/preprod/types/buildDetailsTypes';

export const MOCK_BUILD_DETAILS: BuildDetailsApiResponse = {
  id: 'mock-artifact-123',
  state: BuildDetailsState.PROCESSED,
  app_info: {
    name: 'example-repo',
    platform: 'android',
    version: '1.2.0',
    build_number: '42',
    app_id: 'com.example.repo',
    date_added: '2025-11-19T14:26:31Z',
    date_built: '2025-11-19T14:20:00Z',
    artifact_type: 1, // AAB
    build_configuration: 'release',
    is_installable: true,
  },
  vcs_info: {
    // Match the HEAD commit from Code Coverage view (d677638)
    head_sha: '31b72ff64bd75326ea5e43bf8e93b415db56cb62',
    // Match the BASE commit from Code Coverage view
    base_sha: 'da46d4c13e4a75b7624c8c6763816ecb6dad1968',
    // Match the branch from the PR detail view
    head_ref: 'at/add-tests',
    base_ref: 'main',
    head_repo_name: 'example-org/example-repo',
    base_repo_name: 'example-org/example-repo',
    // Reference PR #10 from pullRequestsData
    pr_number: 10,
    provider: 'github',
  },
  size_info: {
    state: BuildDetailsSizeAnalysisState.COMPLETED,
    // Match PR #10 download size from pullRequestsData (856 KB)
    download_size_bytes: 856000,
    // Match PR #10 uncompressed size from pullRequestsData (2.4 MB)
    install_size_bytes: 2400000,
  },
};

export const MOCK_APP_SIZE_DATA: AppSizeApiResponse = {
  generated_at: '2025-11-19T14:30:00Z',
  treemap: {
    platform: 'android',
    file_count: 850,
    category_breakdown: {
      [TreemapType.DEX]: {total: 900000},
      [TreemapType.NATIVE_LIBRARIES]: {total: 800000},
      [TreemapType.RESOURCES]: {total: 600000},
      [TreemapType.ASSETS]: {total: 80000},
      [TreemapType.OTHER]: {total: 20000},
    },
    root: {
      name: 'root',
      size: 2400000, // Matches install_size_bytes
      is_dir: true,
      type: TreemapType.OTHER,
      children: [
        // Native Libraries (lib folder)
        {
          name: 'lib',
          size: 800000,
          is_dir: true,
          type: TreemapType.NATIVE_LIBRARIES,
          children: [
            {
              name: 'arm64-v8a',
              size: 500000,
              is_dir: true,
              type: TreemapType.NATIVE_LIBRARIES,
              children: [
                {
                  name: 'libapp.so',
                  size: 400000,
                  is_dir: false,
                  type: TreemapType.NATIVE_LIBRARIES,
                  path: 'lib/arm64-v8a/libapp.so',
                },
                {
                  name: 'libutils.so',
                  size: 100000,
                  is_dir: false,
                  type: TreemapType.NATIVE_LIBRARIES,
                  path: 'lib/arm64-v8a/libutils.so',
                },
              ],
            },
            {
              name: 'x86_64',
              size: 300000,
              is_dir: true,
              type: TreemapType.NATIVE_LIBRARIES,
              children: [
                {
                  name: 'libapp.so',
                  size: 240000,
                  is_dir: false,
                  type: TreemapType.NATIVE_LIBRARIES,
                  path: 'lib/x86_64/libapp.so',
                },
                {
                  name: 'libutils.so',
                  size: 60000,
                  is_dir: false,
                  type: TreemapType.NATIVE_LIBRARIES,
                  path: 'lib/x86_64/libutils.so',
                },
              ],
            },
          ],
        },
        // Resources (res folder)
        {
          name: 'res',
          size: 600000,
          is_dir: true,
          type: TreemapType.RESOURCES,
          children: [
            {
              name: 'drawable',
              size: 300000,
              is_dir: true,
              type: TreemapType.RESOURCES,
              children: [
                {
                  name: 'icon.png',
                  size: 150000,
                  is_dir: false,
                  type: TreemapType.RESOURCES,
                  path: 'res/drawable/icon.png',
                },
                {
                  name: 'background.png',
                  size: 150000,
                  is_dir: false,
                  type: TreemapType.RESOURCES,
                  path: 'res/drawable/background.png',
                },
              ],
            },
            {
              name: 'layout',
              size: 200000,
              is_dir: true,
              type: TreemapType.RESOURCES,
              children: [
                {
                  name: 'activity_main.xml',
                  size: 100000,
                  is_dir: false,
                  type: TreemapType.RESOURCES,
                  path: 'res/layout/activity_main.xml',
                },
                {
                  name: 'fragment_list.xml',
                  size: 100000,
                  is_dir: false,
                  type: TreemapType.RESOURCES,
                  path: 'res/layout/fragment_list.xml',
                },
              ],
            },
            {
              name: 'values',
              size: 100000,
              is_dir: true,
              type: TreemapType.RESOURCES,
              children: [
                {
                  name: 'strings.xml',
                  size: 50000,
                  is_dir: false,
                  type: TreemapType.RESOURCES,
                  path: 'res/values/strings.xml',
                },
                {
                  name: 'colors.xml',
                  size: 50000,
                  is_dir: false,
                  type: TreemapType.RESOURCES,
                  path: 'res/values/colors.xml',
                },
              ],
            },
          ],
        },
        // DEX files
        {
          name: 'dex',
          size: 900000,
          is_dir: true,
          type: TreemapType.DEX,
          children: [
            {
              name: 'classes.dex',
              size: 600000,
              is_dir: false,
              type: TreemapType.DEX,
              path: 'dex/classes.dex',
            },
            {
              name: 'classes2.dex',
              size: 300000,
              is_dir: false,
              type: TreemapType.DEX,
              path: 'dex/classes2.dex',
            },
          ],
        },
        // Assets
        {
          name: 'assets',
          size: 80000,
          is_dir: true,
          type: TreemapType.ASSETS,
          children: [
            {
              name: 'data.json',
              size: 50000,
              is_dir: false,
              type: TreemapType.ASSETS,
              path: 'assets/data.json',
            },
            {
              name: 'config.xml',
              size: 30000,
              is_dir: false,
              type: TreemapType.ASSETS,
              path: 'assets/config.xml',
            },
          ],
        },
        // Manifest
        {
          name: 'AndroidManifest.xml',
          size: 15000,
          is_dir: false,
          type: TreemapType.MANIFESTS,
          path: 'AndroidManifest.xml',
        },
        // Compiled resources
        {
          name: 'resources.arsc',
          size: 5000,
          is_dir: false,
          type: TreemapType.COMPILED_RESOURCES,
          path: 'resources.arsc',
        },
      ],
    },
  },
  insights: {
    duplicate_files: {
      total_savings: 15000,
      groups: [
        {
          name: 'Duplicate native libraries',
          total_savings: 15000,
          files: [
            {
              file_path: 'lib/x86_64/libutils.so',
              total_savings: 7500,
            },
            {
              file_path: 'lib/arm64-v8a/libutils.so',
              total_savings: 7500,
            },
          ],
        },
      ],
    },
  },
};
