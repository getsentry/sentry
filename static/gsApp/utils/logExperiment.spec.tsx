import {OrganizationFixture} from 'sentry-fixture/organization';

import {unassignedValue} from 'sentry/data/experimentConfig';
import ConfigStore from 'sentry/stores/configStore';
import localStorage from 'sentry/utils/localStorage';

import logExperiment from 'getsentry/utils/logExperiment';

jest.mock('sentry/utils/localStorage');

jest.mock('sentry/data/experimentConfig', () => ({
  experimentConfig: {
    orgExperiment: {
      key: 'orgExperiment',
      type: 'organization',
      parameter: 'exposed',
      assignments: [1, 0, -1],
    },
    variantExperiment: {
      key: 'variantExperiment',
      type: 'organization',
      parameter: 'variant',
      assignments: [1, 0, -1],
    },
    userExperiment: {
      key: 'userExperiment',
      type: 'user',
      parameter: 'exposed',
      assignments: [1, 0, -1],
    },
  },
}));

const mockedLocalStorageGetItem = localStorage.getItem as jest.MockedFunction<
  typeof localStorage.getItem
>;

describe('logExperiment', function () {
  afterEach(function () {
    jest.clearAllMocks();
    mockedLocalStorageGetItem.mockClear();
  });

  it('logs organization experiments', async function () {
    const organization = OrganizationFixture({
      id: '7',
      experiments: {
        // @ts-expect-error: Using mock keys
        orgExperiment: 1,
      },
    });

    const data = {
      experiment_name: 'orgExperiment',
      unit_name: 'org_id',
      unit_id: parseInt(organization.id, 10),
      params: {exposed: 1},
    };

    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
      body: data,
    });

    logExperiment({
      organization,
      // @ts-expect-error: Using mock keys
      key: 'orgExperiment',
    });

    await tick();

    expect(mock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({data}));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'logged-sentry-experiments',
      JSON.stringify({orgExperiment: parseInt(organization.id, 10)})
    );
  });

  it('logs user experiments', function () {
    ConfigStore.set('user', {
      ...ConfigStore.get('user'),
      id: '123',
      isSuperuser: false,
      experiments: {
        userExperiment: 1,
      },
    });

    const data = {
      experiment_name: 'userExperiment',
      unit_name: 'user_id',
      unit_id: 123,
      params: {exposed: 1},
    };

    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
      body: data,
    });

    logExperiment({
      // @ts-expect-error: Using mock keys
      key: 'userExperiment',
    });

    expect(mock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({data}));
  });

  it('logs different parameters', function () {
    const organization = OrganizationFixture({
      id: '1',
      experiments: {
        // @ts-expect-error: Using mock keys
        variantExperiment: 1,
      },
    });

    const data = {
      experiment_name: 'variantExperiment',
      unit_name: 'org_id',
      unit_id: parseInt(organization.id, 10),
      params: {variant: 1},
    };

    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
      body: data,
    });

    logExperiment({
      organization,
      // @ts-expect-error: Using mock keys
      key: 'variantExperiment',
    });

    expect(mock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({data}));
  });

  it('does not log unassigned experiments', function () {
    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
    });

    const organization = OrganizationFixture({
      id: '1',
      experiments: {
        // @ts-expect-error: Using mock keys
        orgExperiment: unassignedValue,
      },
    });

    logExperiment({
      organization,
      // @ts-expect-error: Using mock keys
      key: 'orgExperiment',
    });

    expect(mock).not.toHaveBeenCalled();
  });

  it('does not log when missing org', function () {
    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
    });

    logExperiment({
      organization: undefined,
      // @ts-expect-error: Using mock keys
      key: 'orgExperiment',
    });

    expect(mock).not.toHaveBeenCalled();
  });
  it("if experiment stored in local storage, don't call log_exposure", async function () {
    const organization = OrganizationFixture({
      id: '7',
      experiments: {
        // @ts-expect-error: Using mock keys
        orgExperiment: 1,
      },
    });

    mockedLocalStorageGetItem.mockImplementation(() =>
      JSON.stringify({orgExperiment: parseInt(organization.id, 10)})
    );

    const data = {
      experiment_name: 'orgExperiment',
      unit_name: 'org_id',
      unit_id: parseInt(organization.id, 10),
      params: {exposed: 1},
    };

    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
      body: data,
    });

    logExperiment({
      organization,
      // @ts-expect-error: Using mock keys
      key: 'orgExperiment',
    });

    await tick();

    expect(mock).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it('if local storage has different experiment, call log_exposure', async function () {
    const organization = OrganizationFixture({
      id: '7',
      experiments: {
        // @ts-expect-error: Using mock keys
        orgExperiment: 1,
      },
    });

    const unit_id = parseInt(organization.id, 10);

    mockedLocalStorageGetItem.mockImplementation(() =>
      JSON.stringify({anotherExperiment: unit_id})
    );

    const data = {
      experiment_name: 'orgExperiment',
      unit_name: 'org_id',
      unit_id,
      params: {exposed: 1},
    };

    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
      body: data,
    });

    logExperiment({
      organization,
      // @ts-expect-error: Using mock keys
      key: 'orgExperiment',
    });

    await tick();

    expect(mock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({data}));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'logged-sentry-experiments',
      JSON.stringify({anotherExperiment: unit_id, orgExperiment: unit_id})
    );
  });
  it('if local storage has different unit_id, call log_exposure', async function () {
    const organization = OrganizationFixture({
      id: '7',
      experiments: {
        // @ts-expect-error: Using mock keys
        orgExperiment: 1,
      },
    });

    const unit_id = parseInt(organization.id, 10);

    mockedLocalStorageGetItem.mockImplementation(() =>
      JSON.stringify({orgExperiment: 12})
    );

    const data = {
      experiment_name: 'orgExperiment',
      unit_name: 'org_id',
      unit_id,
      params: {exposed: 1},
    };

    const mock = MockApiClient.addMockResponse({
      url: '/_experiment/log_exposure/',
      method: 'POST',
      body: data,
    });

    logExperiment({
      organization,
      // @ts-expect-error: Using mock keys
      key: 'orgExperiment',
    });

    await tick();

    expect(mock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({data}));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'logged-sentry-experiments',
      JSON.stringify({orgExperiment: unit_id})
    );
  });
});
