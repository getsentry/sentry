import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Dataset} from 'sentry/views/alerts/rules/metric/types';

import {ErrorMigrationWarning} from './errorMigrationWarning';

describe('ErrorMigrationWarning', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders migration message for filtering archived issues', async () => {
    const rule = MetricRuleFixture({
      projects: [project.slug],
      latestIncident: null,
      dataset: Dataset.ERRORS,
      query: '',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    render(<ErrorMigrationWarning project={project} rule={rule} />, {
      organization,
    });

    expect(
      await screen.findByRole('button', {name: 'Exclude archived issues'})
    ).toBeInTheDocument();
  });

  it('dismisses migration message', async () => {
    const rule = MetricRuleFixture({
      projects: [project.slug],
      latestIncident: null,
      dataset: Dataset.ERRORS,
      query: '',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    const dismissMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
      body: {},
    });
    const {container} = render(<ErrorMigrationWarning project={project} rule={rule} />, {
      organization,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Dismiss Alert'}));

    expect(container).toBeEmptyDOMElement();
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });

  it('renders nothing if the alert was created after the `is:unresolved` feature became available', () => {
    const rule = MetricRuleFixture({
      projects: [project.slug],
      latestIncident: null,
      dataset: Dataset.ERRORS,
      query: '',
      dateCreated: '2024-01-01T00:00:00Z',
    });
    const promptApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    const {container} = render(<ErrorMigrationWarning project={project} rule={rule} />, {
      organization,
    });

    expect(container).toBeEmptyDOMElement();
    expect(promptApi).not.toHaveBeenCalled();
  });
});
