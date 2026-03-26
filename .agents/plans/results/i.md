### I — Admin

| Parametrized path           | Component                             | Layout.Page |
| --------------------------- | ------------------------------------- | ----------- |
| /manage/ (index)            | sentry/views/admin/adminEnvironment   | NO          |
| /manage/status/environment/ | sentry/views/admin/adminEnvironment   | NO          |
| /manage/relays/             | sentry/views/admin/adminRelays        | NO          |
| /manage/organizations/      | sentry/views/admin/adminOrganizations | NO          |
| /manage/projects/           | sentry/views/admin/adminProjects      | NO          |
| /manage/settings/           | sentry/views/admin/adminSettings      | NO          |
| /manage/users/              | sentry/views/admin/adminUsers         | NO          |
| /manage/users/:id           | sentry/views/admin/adminUserEdit      | NO          |
| /manage/status/mail/        | sentry/views/admin/adminMail          | NO          |
| /manage/status/packages/    | sentry/views/admin/adminPackages      | NO          |
| /manage/status/warnings/    | sentry/views/admin/adminWarnings      | NO          |

**Parent wrapper:** adminLayout — uses Layout.Page: NO (uses `SettingsLayout` + `<Outlet />`, no Layout.Page)
**Missing count:** 11
**Notes:** The adminLayout wrapper uses `SettingsLayout` (from `sentry/views/settings/components/settingsLayout`) instead of `Layout.Page`. It renders `<Outlet />` children inside a `<Flex>` + `<BreadcrumbProvider>` + `<SettingsLayout>` structure. None of the child route components use `Layout.Page` either. All 11 routes are non-compliant.
