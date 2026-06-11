import {init, isInitialized} from '@sentry/browser';
import {
  dedupeIntegration,
  functionToStringIntegration,
  inboundFiltersIntegration,
  linkedErrorsIntegration,
  setTag,
} from '@sentry/core';

import type {InitSentryMessage, WorkerMessage} from 'sentry/serviceWorker/types';

const sw = self as unknown as ServiceWorkerGlobalScope;

const DB_NAME = 'sentry-worker';
const STORE_NAME = 'config';
const SENTRY_KEY = 'sentry-init';

interface CachedSentryConfig {
  dsn: string;
  environment?: string;
  tracesSampleRate?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function saveSentryConfig(config: CachedSentryConfig): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(config, SENTRY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save Sentry config'));
  });
}

async function loadSentryConfig(): Promise<CachedSentryConfig | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(SENTRY_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to load Sentry config'));
  });
}

function initSentry(config: {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}): void {
  if (isInitialized()) {
    return;
  }

  init({
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,
    defaultIntegrations: false,
    integrations: [
      inboundFiltersIntegration(),
      functionToStringIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
    ],
    tracesSampleRate: config.tracesSampleRate ?? 0,
    tracePropagationTargets: ['localhost', /^\//],
  });

  setTag('context', 'service-worker');
}

async function handleInitSentry(config: InitSentryMessage): Promise<void> {
  initSentry(config);

  await saveSentryConfig({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
  });
}

async function restoreSentry(): Promise<void> {
  if (isInitialized()) {
    return;
  }
  try {
    const cached = await loadSentryConfig();
    if (cached) {
      initSentry(cached);
    }
  } catch {
    // IndexedDB may be unavailable — not critical
  }
}

function handleMessage(event: ExtendableMessageEvent): void {
  const data = event.data as WorkerMessage;
  switch (data.type) {
    case 'init-sentry':
      event.waitUntil(handleInitSentry(data));
      break;
    default:
      break;
  }
}

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', event => {
  event.waitUntil(Promise.all([sw.clients.claim(), restoreSentry()]));
});

sw.addEventListener('message', handleMessage);
