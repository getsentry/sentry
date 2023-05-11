import {t} from 'sentry/locale';
import {Event, ThreadPoolInfoContext, ThreadPoolInfoContextKey} from 'sentry/types/event';

export const threadPoolInfoKnownDataValues = Object.values(ThreadPoolInfoContextKey);

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

type Props = {
  data: ThreadPoolInfoContext;
  event: Event;
  type: (typeof threadPoolInfoKnownDataValues)[number];
};

export function getThreadPoolInfoKnownDataDetails({
  data,
  type,
}: Props): Output | undefined {
  switch (type) {
    case ThreadPoolInfoContextKey.AVAILABLE_COMPLETION_PORT_THREADS:
      return {
        subject: t('Available Completion Port Threads'),
        value: data.available_completion_port_threads,
      };
    case ThreadPoolInfoContextKey.AVAILABLE_WORKER_THREADS:
      return {
        subject: t('Available Worker Threads'),
        value: data.available_worker_threads,
      };

    case ThreadPoolInfoContextKey.MAX_COMPLETION_PORT_THREADS:
      return {
        subject: t('Max Completion Port Threads'),
        value: data.max_completion_port_threads,
      };
    case ThreadPoolInfoContextKey.MAX_WORKER_THREADS:
      return {
        subject: t('Max Worker Threads'),
        value: data.max_worker_threads,
      };
    case ThreadPoolInfoContextKey.MIN_COMPLETION_PORT_THREADS:
      return {
        subject: t('Min Completion Port Threads'),
        value: data.min_completion_port_threads,
      };
    case ThreadPoolInfoContextKey.MIN_WORKER_THREADS:
      return {
        subject: t('Min Worker Threads'),
        value: data.min_worker_threads,
      };
    default:
      return undefined;
  }
}
