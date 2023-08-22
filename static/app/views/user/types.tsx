import { RefObject } from "react";

export interface FetchOptions {
  userId: string;
  infiniteRef?: RefObject<HTMLDivElement|null> | null;
  limit?: number;
}

export interface ErrorEvent {
  'browser.name': string | null;
  'browser.version': string | null;
  'event.type': 'transaction' | 'error' | 'default';
  id: string;
  message: string;
  'os.name': string | null;
  'os.version': string | null;
  project: string;
  'project.id': string;
  timestamp: string;
}
export interface FetchEventsResponse {
  data: ErrorEvent[];
  meta: any;
}

export interface TransactionEvent extends ErrorEvent {
  'span_ops_breakdown.relative': string;
  'spans.browser': number | null;
  'spans.db': number | null;
  'spans.http': number | null;
  'spans.resource': number | null;
  'spans.ui': number | null;
  'transaction.duration': number | null;
}

export interface FetchTransactionResponse {
  data: TransactionEvent[];
  meta: any;
}

