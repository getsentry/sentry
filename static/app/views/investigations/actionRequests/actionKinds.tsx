import type {ComponentType, ReactNode} from 'react';

import type {ApplyCheck} from 'sentry/views/investigations/actionRequests/applyButton';
import {connectTelemetryUI} from 'sentry/views/investigations/actionRequests/connectTelemetry';
import {updateDetectorUI} from 'sentry/views/investigations/actionRequests/updateDetector';
import type {ActionRequestError} from 'sentry/views/investigations/api';
import type {
  InvestigationAction,
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionByKind = {[A in InvestigationAction as A['kind']]: A};
type ActionKind = keyof ActionByKind;

export type ApplyBlockReason =
  | InvestigationActionRequest['cannotApplyReason']
  | ActionRequestError['code'];

type KindProps<A> = {action: A; actionRequest: InvestigationActionRequest};

export type ActionKindApplyProps<A> = KindProps<A> & {
  applying: boolean;
  check: ApplyCheck;
  finishing: boolean;
  message: string | null;
  onApply: () => void;
  onRecheck: () => void;
  rechecking: boolean;
};

export type ActionKindDetailsProps<A> = KindProps<A> & {
  error: ActionRequestError | null;
  source: InvestigationDetail['source'] | undefined;
};

export type ActionKindUI<A extends InvestigationAction> = {
  Apply: ComponentType<ActionKindApplyProps<A>>;
  checksBeforeApply: boolean;
  getActivityTitle: (
    props: KindProps<A> & {actorName: string | null; organizationSlug: string}
  ) => ReactNode;
  getAppliedSummary: (
    props: KindProps<A> & {source: InvestigationDetail['source'] | undefined}
  ) => ReactNode;
  getCannotApplyMessage: (reason: ApplyBlockReason) => string | null;
  Details?: ComponentType<ActionKindDetailsProps<A>>;
  getActivityNote?: (props: KindProps<A>) => string | null;
  getSuccessMessage?: () => string;
  refreshOnFocus?: (actionRequest: InvestigationActionRequest) => boolean;
};

const ACTION_KIND_UI: {[K in ActionKind]: ActionKindUI<ActionByKind[K]>} = {
  update_detector: updateDetectorUI,
  connect_telemetry: connectTelemetryUI,
};

export function getActionKind<K extends ActionKind>(
  action: ActionByKind[K] | null
): {action: ActionByKind[K]; ui: ActionKindUI<ActionByKind[K]>} | null {
  const ui = action ? ACTION_KIND_UI[action.kind as K] : undefined;
  return action && ui ? {action, ui} : null;
}
