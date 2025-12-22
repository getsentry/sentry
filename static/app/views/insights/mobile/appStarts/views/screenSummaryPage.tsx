import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {SamplesTables} from 'sentry/views/insights/mobile/appStarts/components/samples';
import {
  COLD_START_TYPE,
  StartTypeSelector,
} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import AppStartWidgets from 'sentry/views/insights/mobile/appStarts/components/widgets';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {ModuleName, SpanFields, type SpanProperty} from 'sentry/views/insights/types';

type Query = {
  [SpanFields.APP_START_TYPE]: string;
  'device.class': string;
  primaryRelease: string;
  project: string;
  spanDescription: string;
  spanGroup: string;
  spanOp: string;
  transaction: string;
};

export function ScreenSummaryContentPage() {
  const navigate = useNavigate();
  const location = useLocation<Query>();

  const {
    transaction: transactionName,
    spanGroup,
    [SpanFields.APP_START_TYPE]: appStartType,
  } = location.query;

  const {primaryRelease} = useReleaseSelection();

  useEffect(() => {
    // Default the start type to cold start if not present
    if (!appStartType) {
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            [SpanFields.APP_START_TYPE]: COLD_START_TYPE,
          },
        },
        {replace: true}
      );
    }
  }, [location, appStartType, navigate]);

  useSamplesDrawer({
    Component: <SpanSamplesPanel groupId={spanGroup} moduleName={ModuleName.APP_START} />,
    moduleName: ModuleName.APP_START,
    requiredParams: ['transaction', 'spanGroup', 'spanOp', SpanFields.APP_START_TYPE],
    onClose: () => {
      navigate(
        {
          pathname: location.pathname,
          query: omit(
            location.query,
            'spanGroup',
            'transactionMethod',
            'spanDescription',
            'spanOp'
          ),
        },
        {replace: true}
      );
    },
  });

  let fields: SpanProperty[] = [];
  if (defined(primaryRelease)) {
    fields = [
      `avg_if(span.duration,release,equals,${primaryRelease})`,
      `count_if(release,equals,${primaryRelease})`,
    ];
  } else {
    fields = [`avg(span.duration)`, `count()`];
  }

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <ModulePageFilterBar moduleName={ModuleName.APP_START} disableProjectFilter />
          <ReleaseComparisonSelector moduleName={ModuleName.APP_START} />
          <StartTypeSelector />
        </ToolRibbon>
        <MobileMetricsRibbon
          filters={[
            `transaction:${transactionName}`,
            `span.op:app.start.${appStartType}`,
            '(',
            'span.description:["Cold Start","Cold App Start"]',
            'OR',
            'span.description:["Warm Start","Warm App Start"]',
            ')',
          ]}
          fields={fields}
          blocks={[
            {
              unit: DurationUnit.MILLISECOND,
              allowZero: false,
              title:
                appStartType === COLD_START_TYPE
                  ? t('Avg Cold Start')
                  : t('Avg Warm Start'),
              dataKey: primaryRelease
                ? `avg_if(span.duration,release,equals,${primaryRelease})`
                : 'avg(span.duration)',
            },
            {
              unit: 'count',
              title: t('Count'),
              dataKey: primaryRelease
                ? `count_if(release,equals,${primaryRelease})`
                : 'count()',
            },
          ]}
          referrer="api.insights.mobile-startup-totals"
        />
      </HeaderContainer>
      <ErrorBoundary mini>
        <AppStartWidgets additionalFilters={[`transaction:${transactionName}`]} />
      </ErrorBoundary>
      <SamplesContainer>
        <SamplesTables transactionName={transactionName} />
      </SamplesContainer>
    </Fragment>
  );
}

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
