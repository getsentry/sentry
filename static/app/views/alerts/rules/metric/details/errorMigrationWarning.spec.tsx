import {MetricRule} from 'sentry-fixture/metricRule';
import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Dataset} from 'sentry/views/alerts/rules/metric/types';

import {ErrorMigrationWarning} from './errorMigrationWarning';

describe('ErrorMigrationWarning', () => {
  const project = Project();
  const organization = Organization({features: ['metric-alert-ignore-archived']});

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders migration message for filtering archived issues', async () => {
    const rule = MetricRule({
      projects: [project.slug],
      latestIncident: null,
      dataset: Dataset.ERRORS,
      query: '',
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
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
    const rule = MetricRule({
      projects: [project.slug],
      latestIncident: null,
      dataset: Dataset.ERRORS,
      query: '',
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    const dismissMock = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
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
    const rule = MetricRule({
      projects: [project.slug],
      latestIncident: null,
      dataset: Dataset.ERRORS,
      query: '',
      dateCreated: '2024-01-01T00:00:00Z',
    });
    const promptApi = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    const {container} = render(<ErrorMigrationWarning project={project} rule={rule} />, {
      organization,
    });

    expect(container).toBeEmptyDOMElement();
    expect(promptApi).not.toHaveBeenCalled();
  });
});
