import {useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {EMPTY_DASHBOARD} from './data';
import {DashboardDetailWithInjectedProps as DashboardDetail} from './detail';
import {assignTempId} from './layoutUtils';
import type {DashboardDetails, Widget} from './types';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

export default function CreateDashboard() {
  const organization = useOrganization();
  const location = useLocation();

  const importedDashboard = location.state?.importedDashboard;
  const isImport = Boolean(importedDashboard);

  const [dashboard] = useState<DashboardDetails>(() => {
    const base = cloneDashboard(EMPTY_DASHBOARD);
    if (importedDashboard) {
      return {
        ...base,
        title: importedDashboard.title || base.title,
        widgets: (importedDashboard.widgets || []).map(assignTempId),
        filters: importedDashboard.filters || {},
        environment: importedDashboard.environment || [],
        period: importedDashboard.period || undefined,
      };
    }
    if (location.state?.widgets?.length) {
      return {...base, widgets: location.state.widgets as Widget[]};
    }
    return base;
  });

  useEffect(() => {
    if (isImport) {
      const timeout = window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
      return () => window.clearTimeout(timeout);
    }
    return () => {};
  }, [isImport]);

  function renderDisabled() {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Stack>
    );
  }

  return (
    <Feature
      features="dashboards-edit"
      organization={organization}
      renderDisabled={renderDisabled}
    >
      <ErrorBoundary>
        <DashboardDetail
          initialState={isImport ? DashboardState.PREVIEW : DashboardState.CREATE}
          dashboard={dashboard}
        />
      </ErrorBoundary>
    </Feature>
  );
}
