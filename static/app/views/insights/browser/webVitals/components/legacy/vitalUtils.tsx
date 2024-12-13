import type {Query} from 'history';

import {IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {WebVital} from 'sentry/utils/fields';
import type {Color} from 'sentry/utils/theme';

function generateVitalDetailRoute({orgSlug}: {orgSlug: string}): string {
  return `/organizations/${orgSlug}/performance/vitaldetail/`;
}

export function vitalDetailRouteWithQuery({
  orgSlug,
  vitalName,
  projectID,
  query,
}: {
  orgSlug: string;
  query: Query;
  vitalName: string;
  projectID?: string | string[];
}) {
  const pathname = generateVitalDetailRoute({
    orgSlug,
  });

  return {
    pathname,
    query: {
      vitalName,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
    },
  };
}

export enum VitalState {
  POOR = 'Poor',
  MEH = 'Meh',
  GOOD = 'Good',
}

export const vitalStateColors: Record<VitalState, Color> = {
  [VitalState.POOR]: 'red300',
  [VitalState.MEH]: 'yellow300',
  [VitalState.GOOD]: 'green300',
};

export const webVitalPoor = {
  [WebVital.FP]: 3000,
  [WebVital.FCP]: 3000,
  [WebVital.LCP]: 4000,
  [WebVital.FID]: 300,
  [WebVital.CLS]: 0.25,
};

export const webVitalMeh = {
  [WebVital.FP]: 1000,
  [WebVital.FCP]: 1000,
  [WebVital.LCP]: 2500,
  [WebVital.FID]: 100,
  [WebVital.CLS]: 0.1,
};

export const vitalStateIcons: Record<VitalState, React.ReactNode> = {
  [VitalState.POOR]: <IconSad color={vitalStateColors[VitalState.POOR]} />,
  [VitalState.MEH]: <IconMeh color={vitalStateColors[VitalState.MEH]} />,
  [VitalState.GOOD]: <IconHappy color={vitalStateColors[VitalState.GOOD]} />,
};
