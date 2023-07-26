import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import InternalStatChart from 'sentry/components/internalStatChart';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

const TIME_WINDOWS = ['1h', '1d', '1w'] as const;

type TimeWindow = (typeof TIME_WINDOWS)[number];

type State = DeprecatedAsyncView['state'] & {
  activeTask: string;
  resolution: string;
  since: number;
  taskList: string[];
  taskName: string;
  timeWindow: TimeWindow;
};

export default class AdminQueue extends DeprecatedAsyncView<{}, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      timeWindow: '1w',
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h',
      taskName: null,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['taskList', '/internal/queue/tasks/']];
  }

  changeWindow(timeWindow: TimeWindow) {
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
    this.setState({
      since: new Date().getTime() / 1000 - seconds,
      timeWindow,
    });
  }

  changeTask(value: string) {
    this.setState({activeTask: value});
  }

  renderBody() {
    const {activeTask, taskList} = this.state;

    return (
      <div>
        <Header>
          <h3>Queue Overview</h3>

          <ButtonBar merged active={this.state.timeWindow}>
            {TIME_WINDOWS.map(r => (
              <Button size="sm" barId={r} onClick={() => this.changeWindow(r)} key={r}>
                {r}
              </Button>
            ))}
          </ButtonBar>
        </Header>

        <Panel>
          <PanelHeader>Global Throughput</PanelHeader>
          <PanelBody withPadding>
            <InternalStatChart
              since={this.state.since}
              resolution={this.state.resolution}
              stat="jobs.all.started"
              label="jobs started"
            />
          </PanelBody>
        </Panel>

        <h3>Task Details</h3>

        <div>
          <div className="m-b-1">
            <label>Show details for task:</label>
            <SelectControl
              name="task"
              onChange={({value}) => this.changeTask(value)}
              value={activeTask}
              clearable
              options={taskList.map(value => ({value, label: value}))}
            />
          </div>
          {activeTask ? (
            <div>
              <Panel key={`jobs.started.${activeTask}`}>
                <PanelHeader>
                  Jobs Started <small>{activeTask}</small>
                </PanelHeader>
                <PanelBody withPadding>
                  <InternalStatChart
                    since={this.state.since}
                    resolution={this.state.resolution}
                    stat={`jobs.started.${activeTask}`}
                    label="jobs"
                    height={100}
                  />
                </PanelBody>
              </Panel>
              <Panel key={`jobs.finished.${activeTask}`}>
                <PanelHeader>
                  Jobs Finished <small>{activeTask}</small>
                </PanelHeader>
                <PanelBody withPadding>
                  <InternalStatChart
                    since={this.state.since}
                    resolution={this.state.resolution}
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
}

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
