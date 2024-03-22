import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import type {Threshold} from 'sentry/views/releases/utils/types';

import {type Props, ThresholdGroupRows} from './thresholdGroupRows';

describe('ThresholdGroupRows', () => {
  const PROJECT_NAME = 'test-project';
  const {organization} = initializeOrg({
    organization: {
      name: 'test-org',
      slug: 'test-thresholds',
      features: [],
    },
  });

  const getThreshold = (thresholdData: Partial<Threshold> = {}): Threshold => ({
    id: '1',
    threshold_type: 'threshold_group',
    trigger_type: 'over',
    window_in_seconds: 3600,
    environment: {
      id: '1',
      name: 'production',
      displayName: 'Production',
    },
    project: ProjectFixture({slug: PROJECT_NAME}),
    value: 100,
    ...thresholdData,
  });

  const wrapper = (org: Organization = organization) => {
    return function WrappedComponent({children}) {
      return (
        <OrganizationContext.Provider value={org}>
          {children}
        </OrganizationContext.Provider>
      );
    };
  };

  type RenderProps = Props & {org: Organization};
  const DEFAULT_PROPS: RenderProps = {
    allEnvironmentNames: ['test'],
    project: ProjectFixture(),
    refetch: () => {},
    setTempError: () => {},
    org: organization,
    threshold: undefined,
  };

  const renderComponent = (props: Partial<RenderProps> = DEFAULT_PROPS) => {
    const {org, ...thresholdProps} = props;
    const Wrapper = wrapper(org);

    return render(
      <Wrapper>
        <ThresholdGroupRows {...DEFAULT_PROPS} {...thresholdProps} />
      </Wrapper>
    );
  };

  const mockThresholdApis = (data = {}) => {
    const methods = ['POST', 'PUT', 'DELETE'];
    const mocks = {};

    methods.forEach(method => {
      // /projects/test-thresholds/test-project/release-thresholds/1/
      mocks[`${method}-threshold`] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${PROJECT_NAME}/release-thresholds/${method !== 'POST' ? '1/' : ''}`,
        method,
        body: data,
      });

      mocks[`${method}-alert`] = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/alert-rules/${method !== 'POST' ? '1/' : ''}`,
        method,
        body: data,
      });
    });

    return mocks;
  };

  const editThreshold = async (threshold: Threshold) => {
    const editButton = screen.getByRole('button', {name: 'Edit threshold'});
    await userEvent.click(editButton);

    const saveButton = await screen.findByRole('button', {name: 'Save'});
    expect(saveButton).toBeInTheDocument();

    const spinButtons = screen.getAllByRole('spinbutton');
    const thresholdValueInput = spinButtons.find(
      button => parseInt((button as HTMLButtonElement).value, 10) === threshold.value
    );
    if (!thresholdValueInput) throw new Error('Could not find threshold value input');

    // update the value to 200
    await userEvent.clear(thresholdValueInput);
    await userEvent.type(thresholdValueInput, '200');

    await userEvent.click(saveButton);
  };

  const createThreshold = async () => {
    const addButton = screen.getByRole('button', {name: 'New Threshold'});
    await userEvent.click(addButton);

    const saveButton = await screen.findByRole('button', {name: 'Save'});
    expect(saveButton).toBeInTheDocument();

    /* since we don't have client side validation, we can just click save */
    await userEvent.click(saveButton);
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('invokes the release-threshold api when flag is disabled and editing a threshold', async () => {
    const threshold = getThreshold();
    const mocks = mockThresholdApis();
    renderComponent({threshold});

    expect(await screen.findByText(threshold.value)).toBeInTheDocument();
    await editThreshold(threshold);

    expect(mocks['PUT-alert']).not.toHaveBeenCalled();
    expect(mocks['PUT-threshold']).toHaveBeenCalled();
  });

  it('invokes the alert-rules api when flag is enabled and editing a threshold', async () => {
    const threshold = getThreshold();
    const {organization: org} = initializeOrg({
      organization: {
        name: 'test-org',
        slug: 'test-thresholds',
        features: ['activated-alert-rules'],
      },
    });

    const mocks = mockThresholdApis();
    renderComponent({threshold, org});

    expect(await screen.findByText(threshold.value)).toBeInTheDocument();

    await editThreshold(threshold);

    expect(mocks['PUT-alert']).toHaveBeenCalled();
    expect(mocks['PUT-threshold']).not.toHaveBeenCalled();
  });

  it('uses the release-threshold api when deleting and disabeld', async () => {
    const threshold = getThreshold();
    const mocks = mockThresholdApis();
    renderComponent({threshold});

    expect(await screen.findByText(threshold.value)).toBeInTheDocument();

    const editButton = screen.getByRole('button', {name: 'Edit threshold'});
    await userEvent.click(editButton);

    const deleteButton = await screen.findByRole('button', {name: 'Delete threshold'});
    await userEvent.click(deleteButton);

    expect(mocks['DELETE-alert']).not.toHaveBeenCalled();
    expect(mocks['DELETE-threshold']).toHaveBeenCalled();
  });

  it('uses the alert-rules api when deleting and enabled', async () => {
    const threshold = getThreshold();
    const {organization: org} = initializeOrg({
      organization: {
        name: 'test-org',
        slug: 'test-thresholds',
        features: ['activated-alert-rules'],
      },
    });

    const mocks = mockThresholdApis();
    renderComponent({threshold, org});

    expect(await screen.findByText(threshold.value)).toBeInTheDocument();

    const editButton = screen.getByRole('button', {name: 'Edit threshold'});
    await userEvent.click(editButton);

    const deleteButton = await screen.findByRole('button', {name: 'Delete threshold'});
    await userEvent.click(deleteButton);

    expect(mocks['DELETE-alert']).toHaveBeenCalled();
    expect(mocks['DELETE-threshold']).not.toHaveBeenCalled();
  });

  it('uses the release-threshold api when creating a new threshold and disabled', async () => {
    const threshold = getThreshold();

    const mockThreshold = MockApiClient.addMockResponse({
      url: '/projects/test-thresholds/project-slug/release-thresholds/',
      method: 'POST',
      body: {},
    });

    renderComponent({threshold});
    await createThreshold();

    expect(mockThreshold).toHaveBeenCalled();
  });

  it('uses the alert-rules api when creating a new threshold and enabled', async () => {
    const threshold = getThreshold();

    const mockApi = MockApiClient.addMockResponse({
      url: '/organizations/test-thresholds/alert-rules/',
      method: 'POST',
      body: {},
    });

    const {organization: org} = initializeOrg({
      organization: {
        name: 'test-org',
        slug: 'test-thresholds',
        features: ['activated-alert-rules'],
      },
    });

    renderComponent({threshold, org});
    await createThreshold();

    expect(mockApi).toHaveBeenCalled();
  });
});
