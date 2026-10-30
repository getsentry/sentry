import {useSyncExternalStore} from 'react';

import type {InstrumentationStatus} from 'sentry/views/insights/awsLambda/mockData';

/**
 * In-memory state for the mock's actions (monitors, memory changes, snoozes...). Lives until
 * the page reloads, like an optimistic cache would.
 */
export interface MockMonitor {
  createdAt: number;
  id: string;
  name: string;
  notify: string;
  query: string;
  scope: string;
}

export interface MemoryChange {
  at: number;
  memoryMb: number;
  previousMb: number;
}

interface MockState {
  instrumentation: Record<string, InstrumentationStatus>;
  memoryChanges: Record<string, MemoryChange[]>;
  monitors: MockMonitor[];
  snoozed: Record<string, number>;
  version: number;
}

let state: MockState = {
  version: 0,
  memoryChanges: {},
  instrumentation: {},
  monitors: [],
  snoozed: {},
};
const listeners = new Set<() => void>();

function update(next: Omit<MockState, 'version'>) {
  state = {...next, version: state.version + 1};
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMockState() {
  return state;
}

export function useMockStore() {
  return useSyncExternalStore(subscribe, getMockState);
}

export const mockActions = {
  setMemory(functionName: string, memoryMb: number, previousMb: number) {
    const changes = [
      ...(state.memoryChanges[functionName] ?? []),
      {at: Date.now(), memoryMb, previousMb},
    ];
    update({...state, memoryChanges: {...state.memoryChanges, [functionName]: changes}});
  },
  setInstrumentation(functionName: string, status: InstrumentationStatus) {
    update({
      ...state,
      instrumentation: {...state.instrumentation, [functionName]: status},
    });
  },
  createMonitor(monitor: Omit<MockMonitor, 'id' | 'createdAt'>) {
    update({
      ...state,
      monitors: [
        ...state.monitors,
        {...monitor, id: `m${state.monitors.length + 1}`, createdAt: Date.now()},
      ],
    });
  },
  deleteMonitor(id: string) {
    update({...state, monitors: state.monitors.filter(m => m.id !== id)});
  },
  snooze(insightId: string, until: number) {
    update({...state, snoozed: {...state.snoozed, [insightId]: until}});
  },
  unsnooze(insightId: string) {
    const {[insightId]: _removed, ...rest} = state.snoozed;
    update({...state, snoozed: rest});
  },
};
