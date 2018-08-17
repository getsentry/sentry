import HookStore from 'app/stores/hookStore';
import logExperiment from 'app/utils/logExperiment';

describe('utils/logExperiment', function() {
  let sandbox;
  let myMockFn;

  beforeEach(function() {
    myMockFn = jest.fn();
    sandbox = sinon.sandbox.create();
    sandbox.stub(HookStore, 'get').returns([myMockFn]);
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('logs experiment for those with assignment', function() {
    let experiments = {testExperimentName: 0};
    let data = {unit_name: 'org_id', unit_id: 1, params: 'exposed'};
    logExperiment('testExperimentName', experiments, data);
    data.experiment_name = 'testExperimentName';
    data.params = '{exposed: 0}';
    expect(myMockFn).toHaveBeenCalledWith(data);
  });

  it('does not log experiment without assignment', function() {
    let experiments = {testExperimentName: null};
    let data = {unit_name: 'org_id', unit_id: 1, params: 'exposed'};
    logExperiment('testExperimentName', experiments, data);
    expect(myMockFn).toHaveBeenCalledTimes(0);
  });
});
