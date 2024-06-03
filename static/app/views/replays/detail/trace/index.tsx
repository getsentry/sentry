import {useEffect} from 'react';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import Trace from 'sentry/views/replays/detail/trace/trace';

const features = ['organizations:performance-view'];

function PerfDisabled() {
  return (
    <FeatureDisabled
      featureName={t('Performance Monitoring')}
      features={features}
      hideHelpToggle
      message={t('Requires performance monitoring.')}
    />
  );
}

type EventHandler = (...args: any[]) => void;

class EventEmitter {
  private events: {[key: string]: EventHandler[]} = {};

  on(event: string, handler: EventHandler): void {
    this.events[event] = this.events[event] || [];
    this.events[event].push(handler);
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.events[event] || [];
    handlers.forEach(handler => handler(...args));
  }

  removeListener(event: string, handler: EventHandler): void {
    const handlers = this.events[event];
    if (handlers) {
      this.events[event] = handlers.filter(h => h !== handler);
    }
  }
}

export const replayPlayerTimeEmitter = new EventEmitter();

function TraceFeature() {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const {currentTime, currentHoverTime} = useReplayContext();

  useEffect(() => {
    replayPlayerTimeEmitter.emit('replay player timestamp changed', {
      currentTime,
      currentHoverTime,
    });
  }, [currentTime, currentHoverTime]);

  return (
    <Feature
      features={features}
      hookName={undefined}
      organization={organization}
      renderDisabled={PerfDisabled}
    >
      <Trace replayRecord={replayRecord} />
    </Feature>
  );
}

export default TraceFeature;
