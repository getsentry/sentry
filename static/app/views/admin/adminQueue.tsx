import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {SelectField} from 'app/components/forms';
import InternalStatChart from 'app/components/internalStatChart';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import AsyncView from 'app/views/asyncView';

const TIME_WINDOWS = ['1h', '1d', '1w'] as const;

type TimeWindow = typeof TIME_WINDOWS[number];

type State = AsyncView['state'] & {
  timeWindow: TimeWindow;
  since: number;
  resolution: string;
  taskName: string;
  activeTask: string;
  taskList: string[];
};

export default class AdminQueue extends AsyncView<{}, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      timeWindow: '1w',
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h',
      taskName: null,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
          <h3 className="no-border">Queue Overview</h3>

          <ButtonBar merged active={this.state.timeWindow}>
            {TIME_WINDOWS.map(r => (
              <Button size="small" barId={r} onClick={() => this.changeWindow(r)} key={r}>
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

        <h3 className="no-border">Task Details</h3>

        <div>
          <div className="m-b-1">
            <label>Show details for task:</label>
            <SelectField
              name="task"
              onChange={value => this.changeTask(value as string)}
              value={activeTask}
              clearable
              choices={taskList.map(t => [t, t])}
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
