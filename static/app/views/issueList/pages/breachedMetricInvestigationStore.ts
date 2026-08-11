import {action, makeObservable, observable, runInAction} from 'mobx';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {InvestigationDetail} from 'sentry/views/seerNotebook/types';

type Availability =
  | {status: 'loading' | 'unavailable'}
  | {openPeriodId: string; status: 'investigate'}
  | {investigationId: string; openPeriodId: string; status: 'view'};

type StatusResponse = {
  items: Record<string, Exclude<Availability, {status: 'loading'}>>;
};

export type BreachedMetricInvestigationActionState = {
  busy: boolean;
  kind: 'investigate' | 'view';
};

export class BreachedMetricInvestigationStore {
  availability = new Map<string, Availability>();
  launching = new Set<string>();

  private pendingGroupIds = new Set<string>();
  private flushScheduled = false;

  constructor(
    private organizationSlug: string,
    private navigate: (path: string) => void
  ) {
    makeObservable(this, {
      availability: observable,
      launching: observable,
      register: action,
      launch: action,
    });
  }

  register(groupId: string) {
    if (this.availability.has(groupId)) {
      return;
    }
    this.availability.set(groupId, {status: 'loading'});
    this.pendingGroupIds.add(groupId);
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    queueMicrotask(() => void this.loadPending());
  }

  actionFor(groupId: string): BreachedMetricInvestigationActionState | null {
    const availability = this.availability.get(groupId);
    if (availability?.status !== 'investigate' && availability?.status !== 'view') {
      return null;
    }
    return {kind: availability.status, busy: this.launching.has(groupId)};
  }

  async launch(groupId: string) {
    const current = this.availability.get(groupId);
    if (current?.status === 'view') {
      this.open(current.investigationId);
      return;
    }
    if (current?.status !== 'investigate' || this.launching.has(groupId)) {
      return;
    }

    this.launching.add(groupId);
    try {
      const investigation = await fetchMutation<InvestigationDetail>({
        url: `/organizations/${this.organizationSlug}/investigations/breached-metric/launch/`,
        method: 'POST',
        data: {groupId, openPeriodId: current.openPeriodId},
      });
      runInAction(() => {
        this.launching.delete(groupId);
        this.availability.set(groupId, {
          status: 'view',
          investigationId: investigation.id,
          openPeriodId: current.openPeriodId,
        });
      });
      this.open(investigation.id);
    } catch {
      runInAction(() => {
        this.launching.delete(groupId);
        this.availability.set(groupId, current);
      });
      addErrorMessage(t('Unable to create the investigation. Please try again.'));
    }
  }

  private async loadPending() {
    const groupIds = Array.from(this.pendingGroupIds);
    this.pendingGroupIds.clear();
    this.flushScheduled = false;
    if (!groupIds.length) {
      return;
    }
    try {
      const response = await fetchMutation<StatusResponse>({
        url: `/organizations/${this.organizationSlug}/investigations/breached-metric/status/`,
        method: 'POST',
        data: {groupIds},
      });
      runInAction(() => {
        for (const groupId of groupIds) {
          this.availability.set(
            groupId,
            response.items[groupId] ?? {status: 'unavailable'}
          );
        }
      });
    } catch {
      runInAction(() => {
        for (const groupId of groupIds) {
          this.availability.set(groupId, {status: 'unavailable'});
        }
      });
    }
  }

  private open(investigationId: string) {
    this.navigate(
      `/organizations/${this.organizationSlug}/seer/${encodeURIComponent(
        investigationId
      )}/`
    );
  }
}
