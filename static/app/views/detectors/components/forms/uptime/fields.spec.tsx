import {UptimeDetectorFixture} from 'sentry-fixture/detectors';

import {UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';
import {
  UPTIME_DEFAULT_DOWNTIME_THRESHOLD,
  UPTIME_DEFAULT_RECOVERY_THRESHOLD,
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';

describe('uptimeFormDataToEndpointPayload', () => {
  it('converts form data to endpoint payload', () => {
    const formData = {
      name: 'Test Monitor',
      owner: 'user:1',
      projectId: '123',
      workflowIds: [],
      description: 'Test description',
      intervalSeconds: 60,
      method: 'GET',
      timeoutMs: 10000,
      traceSampling: false,
      url: 'https://example.com',
      headers: [['X-Test', 'value'] as [string, string]],
      body: '',
      assertion: null,
      recoveryThreshold: 1,
      downtimeThreshold: 3,
      environment: 'production',
    };

    const payload = uptimeFormDataToEndpointPayload(formData);

    expect(payload).toEqual({
      type: 'uptime_domain_failure',
      name: 'Test Monitor',
      owner: 'user:1',
      projectId: '123',
      workflowIds: [],
      description: 'Test description',
      dataSources: [
        {
          intervalSeconds: 60,
          method: 'GET',
          timeoutMs: 10000,
          traceSampling: false,
          url: 'https://example.com',
          headers: [['X-Test', 'value']],
          body: null,
          assertion: null,
        },
      ],
      config: {
        mode: UptimeMonitorMode.MANUAL,
        recoveryThreshold: 1,
        downtimeThreshold: 3,
        environment: 'production',
      },
    });
  });

  it('includes assertion in payload when provided', () => {
    const assertion = {
      root: {
        op: 'and' as const,
        children: [
          {
            id: 'test-1',
            op: 'status_code_check' as const,
            operator: {cmp: 'equals' as const},
            value: 200,
          },
        ],
        id: 'root-1',
      },
    };

    const formData = {
      name: 'Test Monitor with Assertion',
      owner: 'user:1',
      projectId: '123',
      workflowIds: [],
      description: null,
      intervalSeconds: 60,
      method: 'GET',
      timeoutMs: 10000,
      traceSampling: false,
      url: 'https://example.com',
      headers: [],
      body: '',
      assertion,
      recoveryThreshold: 1,
      downtimeThreshold: 3,
      environment: 'production',
    };

    const payload = uptimeFormDataToEndpointPayload(formData);

    expect(payload.dataSources[0]?.assertion).toEqual(assertion);
  });

  it('converts body to null when empty string', () => {
    const formData = {
      name: 'Test Monitor',
      owner: 'user:1',
      projectId: '123',
      workflowIds: [],
      description: null,
      intervalSeconds: 60,
      method: 'GET',
      timeoutMs: 10000,
      traceSampling: false,
      url: 'https://example.com',
      headers: [],
      body: '',
      assertion: null,
      recoveryThreshold: 1,
      downtimeThreshold: 3,
      environment: 'production',
    };

    const payload = uptimeFormDataToEndpointPayload(formData);

    expect(payload.dataSources[0]?.body).toBeNull();
  });

  it('includes non-empty body in payload', () => {
    const formData = {
      name: 'Test Monitor',
      owner: 'user:1',
      projectId: '123',
      workflowIds: [],
      description: null,
      intervalSeconds: 60,
      method: 'POST',
      timeoutMs: 10000,
      traceSampling: false,
      url: 'https://example.com',
      headers: [],
      body: '{"key": "value"}',
      assertion: null,
      recoveryThreshold: 1,
      downtimeThreshold: 3,
      environment: 'production',
    };

    const payload = uptimeFormDataToEndpointPayload(formData);

    expect(payload.dataSources[0]?.body).toBe('{"key": "value"}');
  });

  it('uses default thresholds when not provided', () => {
    const formData = {
      name: 'Test Monitor',
      owner: 'user:1',
      projectId: '123',
      workflowIds: [],
      description: null,
      intervalSeconds: 60,
      method: 'GET',
      timeoutMs: 10000,
      traceSampling: false,
      url: 'https://example.com',
      headers: [],
      body: '',
      assertion: null,
      recoveryThreshold: undefined as any,
      downtimeThreshold: undefined as any,
      environment: 'production',
    };

    const payload = uptimeFormDataToEndpointPayload(formData);

    expect(payload.config.recoveryThreshold).toBe(UPTIME_DEFAULT_RECOVERY_THRESHOLD);
    expect(payload.config.downtimeThreshold).toBe(UPTIME_DEFAULT_DOWNTIME_THRESHOLD);
  });
});

describe('uptimeSavedDetectorToFormData', () => {
  it('converts detector to form data', () => {
    const detector = UptimeDetectorFixture({
      name: 'Saved Monitor',
      owner: {type: 'user', id: '1', name: 'User 1'},
      projectId: '123',
      config: {
        environment: 'production',
        recoveryThreshold: 2,
        downtimeThreshold: 5,
        mode: UptimeMonitorMode.MANUAL,
      },
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData).toMatchObject({
      name: 'Saved Monitor',
      owner: 'user:1',
      projectId: '123',
      environment: 'production',
      recoveryThreshold: 2,
      downtimeThreshold: 5,
    });
  });

  it('extracts assertion from data source', () => {
    const assertion = {
      root: {
        op: 'and' as const,
        children: [
          {
            id: 'test-1',
            op: 'status_code_check' as const,
            operator: {cmp: 'equals' as const},
            value: 200,
          },
        ],
        id: 'root-1',
      },
    };

    const detector = UptimeDetectorFixture({
      dataSources: [
        {
          ...UptimeDetectorFixture().dataSources[0],
          queryObj: {
            ...UptimeDetectorFixture().dataSources[0].queryObj,
            assertion,
          },
        },
      ],
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData.assertion).toEqual(assertion);
  });

  it('sets assertion to null when not present in data source', () => {
    const detector = UptimeDetectorFixture({
      dataSources: [
        {
          ...UptimeDetectorFixture().dataSources[0],
          queryObj: {
            ...UptimeDetectorFixture().dataSources[0].queryObj,
            assertion: undefined as any,
          },
        },
      ],
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData.assertion).toBeNull();
  });

  it('uses default values when data source is missing', () => {
    const detector = UptimeDetectorFixture({
      dataSources: [] as any,
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData).toMatchObject({
      intervalSeconds: 60,
      method: 'GET',
      timeoutMs: 10000,
      traceSampling: false,
      url: 'https://example.com',
      headers: [],
      body: '',
      assertion: null,
    });
  });

  it('uses default thresholds when config is missing', () => {
    const detector = UptimeDetectorFixture({
      config: {} as any,
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData.recoveryThreshold).toBe(UPTIME_DEFAULT_RECOVERY_THRESHOLD);
    expect(formData.downtimeThreshold).toBe(UPTIME_DEFAULT_DOWNTIME_THRESHOLD);
  });

  it('converts body to empty string when null', () => {
    const detector = UptimeDetectorFixture({
      dataSources: [
        {
          ...UptimeDetectorFixture().dataSources[0],
          queryObj: {
            ...UptimeDetectorFixture().dataSources[0].queryObj,
            body: null,
          },
        },
      ],
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData.body).toBe('');
  });

  it('preserves non-null body', () => {
    const detector = UptimeDetectorFixture({
      dataSources: [
        {
          ...UptimeDetectorFixture().dataSources[0],
          queryObj: {
            ...UptimeDetectorFixture().dataSources[0].queryObj,
            body: '{"test": "data"}',
          },
        },
      ],
    });

    const formData = uptimeSavedDetectorToFormData(detector);

    expect(formData.body).toBe('{"test": "data"}');
  });
});
