import {InjectedRouter} from 'react-router';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import GlobalModal from 'sentry/components/globalModal';
import {Organization, Project} from 'sentry/types';
import {SamplingInnerName} from 'sentry/types/sampling';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';
import {distributedTracesConditions} from 'sentry/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils';
import {getInnerNameLabel} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData} from './index.spec';

function TestComponent({
  router,
  project,
  organization,
}: {
  organization: Organization;
  project: Project;
  router: InjectedRouter;
}) {
  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {
          orgId: organization.slug,
          projectId: project.slug,
        },
        routes: [],
      }}
    >
      <GlobalModal />
      <OrganizationContext.Provider value={organization}>
        <ServerSideSampling project={project} />
      </OrganizationContext.Provider>
    </RouteContext.Provider>
  );
}

describe('Server-side Sampling - Specific Conditions Modal', function () {
  const uniformRule = {
    sampleRate: 1,
    type: 'trace',
    active: false,
    condition: {
      op: 'and',
      inner: [],
    },
    id: 1,
  };

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/',
      body: TestStubs.Tags,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('add new rule', async function () {
    const {organization, project, router} = getMockData({
      project: TestStubs.Project({
        dynamicSampling: {
          rules: [uniformRule],
        },
      }),
    });

    const newRule = {
      condition: {
        inner: [{name: 'trace.release', op: 'glob', value: ['1.2.3']}],
        op: 'and',
      },
      id: 0,
      sampleRate: 0.2,
      type: 'trace',
      active: false,
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [uniformRule, newRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    // Rules Panel Content
    userEvent.click(screen.getByLabelText('Add Rule'));

    const dialog = await screen.findByRole('dialog');

    // Dialog Header
    expect(screen.getByRole('heading', {name: 'Add Rule'})).toBeInTheDocument();

    // Dialog Content
    expect(
      screen.getByText(
        'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('No conditions added')).toBeInTheDocument();

    expect(
      screen.getByText('Click on the button above to add (+) a condition')
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText('\u0025')).toHaveTextContent('');

    // Dialog Footer
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Save Rule'})).toBeDisabled();

    userEvent.hover(screen.getByText('Save Rule'));

    expect(
      await screen.findByText('Required fields must be filled out')
    ).toBeInTheDocument();

    // Click on 'Add condition'
    userEvent.click(screen.getByText('Add Condition'));

    // Autocomplete
    expect(screen.getByText(/filter conditions/i)).toBeInTheDocument();

    // Distributed Traces Options
    distributedTracesConditions.forEach(condition => {
      expect(within(dialog).getByText(getInnerNameLabel(condition))).toBeInTheDocument();
    });

    // Click on the condition option
    userEvent.click(
      within(dialog).getByText(getInnerNameLabel(SamplingInnerName.TRACE_RELEASE))
    );

    // Release field is empty
    expect(screen.queryByTestId('multivalue')).not.toBeInTheDocument();

    // Type into release field
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');

    // Autocomplete suggests options
    expect(screen.getByTestId('1.2.3')).toHaveTextContent('1.2.3');

    // Click on the suggested option
    userEvent.click(screen.getByTestId('1.2.3'));

    // Button is still disabled
    expect(screen.getByLabelText('Save Rule')).toBeDisabled();

    // Fill sample rate field
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '20');

    // Save button is now enabled
    expect(screen.getByLabelText('Save Rule')).toBeEnabled();

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Dialog should close
    await waitForElementToBeRemoved(() => screen.queryByText('Save Rule'), {
      timeout: 2500,
    });

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [uniformRule, newRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully added sampling rule'
    );
  });

  it('edits the rule', async function () {
    const specificRule = {
      sampleRate: 0.2,
      active: false,
      type: 'trace',
      condition: {
        op: 'and',
        inner: [
          {
            op: 'glob',
            name: 'trace.release',
            value: ['1.2.2'],
          },
        ],
      },
      id: 2,
    };

    const {organization, project, router} = getMockData({
      project: TestStubs.Project({
        dynamicSampling: {
          rules: [uniformRule, specificRule],
        },
      }),
    });

    const newRule = {
      ...specificRule,
      id: 0,
      sampleRate: 0.6,
    };

    const saveMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [uniformRule, newRule],
        },
      }),
    });

    jest.spyOn(indicators, 'addSuccessMessage');

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    expect(screen.getByText('1.2.2')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();

    const samplingRule = screen.getAllByTestId('sampling-rule')[1];

    // Rules Panel Content
    userEvent.click(within(samplingRule).getByLabelText('Actions'));

    userEvent.click(within(samplingRule).getByText('Edit'));

    await screen.findByRole('dialog');

    // Empty conditions message is not displayed
    expect(screen.queryByText('No conditions added')).not.toBeInTheDocument();

    // Type into realease field
    userEvent.clear(screen.getByLabelText('Search or add a release'));
    userEvent.paste(screen.getByLabelText('Search or add a release'), '1.2.3');

    // Click on the suggested option
    userEvent.click(await screen.findByText(textWithMarkupMatcher('Add "1.2.3"')));

    // Update sample rate field
    userEvent.clear(screen.getByPlaceholderText('\u0025'));
    userEvent.paste(screen.getByPlaceholderText('\u0025'), '60');

    // Click on save button
    userEvent.click(screen.getByLabelText('Save Rule'));

    // Modal will close
    await waitForElementToBeRemoved(() => screen.queryByText('Edit Rule'));

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(saveMock).toHaveBeenLastCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          dynamicSampling: {
            rules: [uniformRule, newRule],
          },
        },
      })
    );

    expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
      'Successfully edited sampling rule'
    );
  });

  it('does not let you add without permissions', async function () {
    const {organization, project, router} = getMockData({
      project: TestStubs.Project({
        dynamicSampling: {
          rules: [uniformRule],
        },
      }),
      access: [],
    });

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();
    userEvent.hover(screen.getByText('Add Rule'));
    expect(
      await screen.findByText("You don't have permission to add a rule")
    ).toBeInTheDocument();
  });
});
