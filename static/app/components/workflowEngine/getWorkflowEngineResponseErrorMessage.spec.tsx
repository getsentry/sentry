import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';

describe('getWorkflowEngineResponseErrorMessage', () => {
  it('returns undefined for undefined', () => {
    expect(getWorkflowEngineResponseErrorMessage(undefined)).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(getWorkflowEngineResponseErrorMessage({})).toBeUndefined();
  });

  it('handles {detail: "message"} shape', () => {
    expect(getWorkflowEngineResponseErrorMessage({detail: 'Something went wrong'})).toBe(
      'Something went wrong'
    );
  });

  it('handles {field: ["message"]} shape', () => {
    expect(getWorkflowEngineResponseErrorMessage({name: ['Name is required']})).toBe(
      'Name is required'
    );
  });

  it('handles {dataSources: {field: ["message"]}} shape', () => {
    expect(
      getWorkflowEngineResponseErrorMessage({dataSources: {query: ['Invalid query']}})
    ).toBe('Invalid query');
  });

  it('handles {actions: [{field: "message"}]} shape', () => {
    expect(
      getWorkflowEngineResponseErrorMessage({
        actions: [{repo: 'Repository is required'}],
      })
    ).toBe('Repository is required');
  });

  it('returns the first message when multiple fields have errors', () => {
    const result = getWorkflowEngineResponseErrorMessage({
      name: ['Name error'],
      query: ['Query error'],
    });
    expect(result).toBe('Name error');
  });
});
