import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

import {PreprodBuildsSnapshotTable} from './preprodBuildsSnapshotTable';

jest.mock('@sentry/scraps/badge', () => ({
  ...jest.requireActual('sentry/components/core/badge/tag'),
}));

jest.mock('./preprodBuildsTableCommon', () => ({
  FullRowLink: ({to, children, ...props}: any) => (
    <a
      href={typeof to === 'string' ? to : '#'}
      {...props}
      style={{display: 'contents', color: 'inherit', textDecoration: 'none'}}
    >
      {children}
    </a>
  ),
}));

jest.mock('@sentry/scraps/tooltip', () => ({
  Tooltip: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('sentry/components/timeSince', () => ({
  TimeSince: ({date}: {date: string}) => <time dateTime={date}>1 hour ago</time>,
}));

const themes = {light: lightTheme, dark: darkTheme};

function makeBuild(
  overrides: Partial<BuildDetailsApiResponse> = {}
): BuildDetailsApiResponse {
  return {
    id: 'snap-001',
    project_id: 1,
    project_slug: 'mobile-app',
    state: BuildDetailsState.PROCESSED,
    app_info: {
      app_id: 'com.example.app',
      name: 'Example App',
      version: '2.1.0',
      build_number: '87',
      date_added: '2025-01-15T10:30:00Z',
    },
    distribution_info: {
      is_installable: false,
      download_count: 0,
      release_notes: null,
    },
    vcs_info: {
      head_sha: 'a1b2c3d4e5f6',
      head_ref: 'feat/new-button',
      pr_number: 42,
      base_sha: 'f6e5d4c3b2a1',
      base_ref: 'main',
    },
    snapshot_comparison_info: {
      image_count: 24,
      comparison_state: 'success',
      approval_status: 'approved',
      comparison_error_message: null,
      images_added: 2,
      images_removed: 0,
      images_changed: 3,
      images_unchanged: 19,
    },
    ...overrides,
  };
}

describe('PreprodBuildsSnapshotTable', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    const theme = themes[themeName];

    function renderTable(build: BuildDetailsApiResponse) {
      return (
        <ThemeProvider theme={theme}>
          <div
            style={{
              width: 960,
              color: String(theme.tokens.content.primary),
              background: String(theme.tokens.background.primary),
            }}
          >
            <PreprodBuildsSnapshotTable
              builds={[build]}
              organizationSlug="test-org"
              showProjectColumn={false}
            />
          </div>
        </ThemeProvider>
      );
    }

    it.snapshot('status-approved', () => renderTable(makeBuild()), {
      theme: themeName,
      state: 'status-approved',
    });

    it.snapshot(
      'status-needs-approval',
      () =>
        renderTable(
          makeBuild({
            snapshot_comparison_info: {
              image_count: 24,
              comparison_state: 'success',
              approval_status: 'requires_approval',
              comparison_error_message: null,
              images_added: 2,
              images_removed: 0,
              images_changed: 3,
              images_unchanged: 19,
            },
          })
        ),
      {theme: themeName, state: 'status-needs-approval'}
    );

    it.snapshot(
      'status-no-base-build',
      () =>
        renderTable(
          makeBuild({
            snapshot_comparison_info: {
              image_count: 24,
              comparison_state: 'no_base_build',
              approval_status: null,
              comparison_error_message: null,
              images_added: 0,
              images_removed: 0,
              images_changed: 0,
              images_unchanged: 0,
            },
          })
        ),
      {theme: themeName, state: 'status-no-base-build'}
    );

    it.snapshot(
      'status-no-comparison',
      () =>
        renderTable(
          makeBuild({
            snapshot_comparison_info: undefined,
          })
        ),
      {theme: themeName, state: 'status-no-comparison'}
    );

    it.snapshot(
      'changes-no-changes',
      () =>
        renderTable(
          makeBuild({
            snapshot_comparison_info: {
              image_count: 20,
              comparison_state: 'success',
              approval_status: 'approved',
              comparison_error_message: null,
              images_added: 0,
              images_removed: 0,
              images_changed: 0,
              images_unchanged: 20,
            },
          })
        ),
      {theme: themeName, state: 'changes-no-changes'}
    );
  });
});
