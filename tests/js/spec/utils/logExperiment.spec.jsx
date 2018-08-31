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
    logExperiment(experiments, 'testExperimentName', 'org_id', 1, 'exposed');
    expect(myMockFn).toHaveBeenCalledWith({
      experiment_name: 'testExperimentName',
      unit_name: 'org_id',
      unit_id: 1,
      params: {
        exposed: 0,
      },
    });
  });

  it('does not log experiment without assignment', function() {
    logExperiment({}, 'testExperimentName', 'org_id', 1, 'exposed');
    expect(myMockFn).toHaveBeenCalledTimes(0);
  });
});
