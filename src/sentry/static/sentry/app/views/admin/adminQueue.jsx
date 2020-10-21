import AsyncView from 'app/views/asyncView';
import InternalStatChart from 'app/components/internalStatChart';
import {SelectField} from 'app/components/forms';

export default class AdminQueue extends AsyncView {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      timeWindow: '1w',
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h',
      taskName: null,
    };
  }

  getEndpoints() {
    return [['taskList', '/internal/queue/tasks/']];
  }

  changeWindow(timeWindow) {
    let seconds;
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

  changeTask = value => {
    this.setState({activeTask: value});
  };

  renderBody() {
    const {activeTask, taskList} = this.state;

    return (
      <div>
        <div className="btn-group pull-right">
          {['1h', '1d', '1w'].map(r => (
            <a
              className={`btn btn-sm ${
                r === this.state.timeWindow ? 'btn-primary' : 'btn-default'
              }`}
              onClick={() => this.changeWindow(r)}
              key={r}
            >
              {r}
            </a>
          ))}
        </div>

        <h3 className="no-border">Queue Overview</h3>

        <div className="box">
          <div className="box-header">
            <h3>Global Throughput</h3>
          </div>
          <InternalStatChart
            since={this.state.since}
            resolution={this.state.resolution}
            stat="jobs.all.started"
            label="jobs started"
          />
        </div>

        <h3 className="no-border">Task Details</h3>

        <div>
          <div>
            <label>Show details for task:</label>
            <SelectField
              deprecatedSelectControl
              name="task"
              onChange={this.changeTask}
              value={activeTask}
              allowClear
              choices={[''].concat(...taskList).map(t => [t, t])}
            />
          </div>
          {activeTask ? (
            <div>
              <div className="box box-mini" key="jobs.started">
                <div className="box-header">
                  Jobs Started <small>{activeTask}</small>
                </div>
                <InternalStatChart
                  since={this.state.since}
                  resolution={this.state.resolution}
                  stat={`jobs.started.${this.state.activeTask}`}
                  label="jobs"
                  height={100}
                />
              </div>
              <div className="box box-mini" key="jobs.finished">
                <div className="box-header">
                  Jobs Finished <small>{activeTask}</small>
                </div>
                <InternalStatChart
                  since={this.state.since}
                  resolution={this.state.resolution}
                  stat={`jobs.finished.${this.state.activeTask}`}
                  label="jobs"
                  height={100}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
