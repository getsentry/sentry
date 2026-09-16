import type {ReactElement} from 'react';
import {ThemeProvider} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import type {SnapshotRenderContext} from './snapshotScenarios';

const THEMES = {light: lightTheme, dark: darkTheme};

export function renderWithSnapshotProviders(
  {features, theme}: SnapshotRenderContext,
  children: ReactElement
): ReactElement {
  const organization = OrganizationFixture({
    dateCreated: '2015-01-01T00:00:00.000Z',
    features,
  });

  return (
    <OrganizationContext value={organization}>
      <ThemeProvider theme={THEMES[theme]}>{children}</ThemeProvider>
    </OrganizationContext>
  );
}
