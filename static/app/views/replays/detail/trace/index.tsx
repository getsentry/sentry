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

type ReplayPlayerTimestampChange = {
  currentHoverTime: number | undefined;
  currentTime: number;
};
type ReplayPlayerListener = (arg: ReplayPlayerTimestampChange) => void;

class ReplayPlayerTimestampEmitter {
  private listeners: {[key: string]: ReplayPlayerListener[]} = {};

  on(event: 'replay timestamp change', handler: ReplayPlayerListener): void {
    this.listeners[event] = this.listeners[event] || [];
    if (!this.listeners[event].includes(handler)) {
      this.listeners[event].push(handler);
    }
  }

  emit(event: 'replay timestamp change', arg: ReplayPlayerTimestampChange): void {
    const handlers = this.listeners[event] || [];
    handlers.forEach(handler => handler(arg));
  }

  off(event: 'replay timestamp change', handler: ReplayPlayerListener): void {
    const handlers = this.listeners[event];
    if (handlers) {
      this.listeners[event] = handlers.filter(h => h !== handler);
    }
  }
}

export const replayPlayerTimestampEmitter = new ReplayPlayerTimestampEmitter();

function TraceFeature() {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const {currentTime, currentHoverTime} = useReplayContext();

  useEffect(() => {
    replayPlayerTimestampEmitter.emit('replay timestamp change', {
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
