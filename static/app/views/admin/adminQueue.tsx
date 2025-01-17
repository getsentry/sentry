import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import InternalStatChart from 'sentry/components/internalStatChart';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

const TIME_WINDOWS = ['1h', '1d', '1w'] as const;

type TimeWindow = (typeof TIME_WINDOWS)[number];

type State = {
  activeTask: string;
  resolution: string;
  since: number;
  timeWindow: TimeWindow;
};

export default function AdminQueue() {
  const [state, setState] = useState<State>({
    timeWindow: '1w',
    since: new Date().getTime() / 1000 - 3600 * 24 * 7,
    resolution: '1h',
    activeTask: '',
  });

  const {
    data: taskList,
    isPending,
    isError,
  } = useApiQuery<string[]>(['/internal/queue/tasks/'], {
    staleTime: 0,
  });

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const changeWindow = (timeWindow: TimeWindow) => {
    let seconds: number;
    if (timeWindow === '1h') {
      seconds = 3600;
    } else if (timeWindow === '1d') {
      seconds = 3600 * 24;
    } else if (timeWindow === '1w') {
      seconds = 3600 * 24 * 7;
    } else {
      throw new Error('Invalid time window');
    }
    setState(prevState => ({
      ...prevState,
      since: new Date().getTime() / 1000 - seconds,
      timeWindow,
    }));
  };

  const changeTask = (value: string) => {
    setState(prevState => ({...prevState, activeTask: value}));
  };

  const {activeTask} = state;

  return (
    <div>
      <Header>
        <h3>t{'Queue Overview'}</h3>

        <ButtonBar merged active={state.timeWindow}>
          {TIME_WINDOWS.map(r => (
            <Button size="sm" barId={r} onClick={() => changeWindow(r)} key={r}>
              {r}
            </Button>
          ))}
        </ButtonBar>
      </Header>

      <Panel>
        <PanelHeader>{t('Global Throughput')}</PanelHeader>
        <PanelBody withPadding>
          <InternalStatChart
            since={state.since}
            resolution={state.resolution}
            stat="jobs.all.started"
            label="jobs started"
          />
        </PanelBody>
      </Panel>

      <h3>t{'Task Details'}</h3>

      <div>
        <div className="m-b-1">
          <label>t{'Show details for task:'}</label>
          <SelectControl
            name="task"
            onChange={({value}: any) => changeTask(value)}
            value={activeTask}
            clearable
            options={taskList.map(value => ({value, label: value}))}
          />
        </div>
        {activeTask ? (
          <div>
            <Panel key={`jobs.started.${activeTask}`}>
              <PanelHeader>
                {t('Jobs Started')} <small>{activeTask}</small>
              </PanelHeader>
              <PanelBody withPadding>
                <InternalStatChart
                  since={state.since}
                  resolution={state.resolution}
                  stat={`jobs.started.${activeTask}`}
                  label="jobs"
                  height={100}
                />
              </PanelBody>
            </Panel>
            <Panel key={`jobs.finished.${activeTask}`}>
              <PanelHeader>
                {t('Jobs Finished')} <small>{activeTask}</small>
              </PanelHeader>
              <PanelBody withPadding>
                <InternalStatChart
                  since={state.since}
                  resolution={state.resolution}
                  stat={`jobs.finished.${activeTask}`}
                  label="jobs"
                  height={100}
                />
              </PanelBody>
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
