import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {InvestigationRuleCreation} from 'sentry/components/dynamicSampling/investigationRule';
import EventView from 'sentry/utils/discover/eventView';

jest.mock('sentry/actionCreators/indicator');

describe('InvestigationRule', function () {
  let context;
  let organization;
  let project;
  let eventView;

  const buttonText = /Get Samples/i;
  const labelText = /Collecting samples/i;
  let getRuleMock; // the endpoint that checks if a rule exists

  function initialize(config = {}) {
    context = initializeOrg(config);
    organization = context.organization;
    project = context.project;
  }

  function getCustomRule() {
    return {
      samplingValue: {type: 'reservoir', limit: 100},
      type: 'transaction',
      id: 3001,
      condition: {op: 'and', inner: []},
      timeRange: {
        start: '2023-10-10T12:20:00Z',
        end: '2024-10-10T12:20:00Z',
      },
    };
  }

  function initComponentEnvironment({hasFeature, hasRule}) {
    const features = hasFeature ? ['investigation-bias'] : [];
    initialize({organization: {features}});

    if (hasRule) {
      getRuleMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
        method: 'GET',
        statusCode: 200,
        body: JSON.stringify(getCustomRule()),
      });
    } else {
      getRuleMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
        method: 'GET',
        statusCode: 204,
        body: '',
      });
    }
    eventView = EventView.fromSavedQuery({
      id: 'query-id',
      name: 'some query',
      version: 2,
      fields: ['transaction', 'count()'],
      projects: [project.id],
    });
  }

  // (RaduW) 2023-10-13 Can we do any better than this?
  // I need to wait for the component to render (give it time to settle) but then
  // it should not render anything
  async function expectNotToRender() {
    // wait for the button to appear (it shouldn't)
    try {
      await screen.findByText(buttonText);
    } catch (e) {
      // continue
    }

    // check we don't have either button or label ( even after waiting for them to appear)
    // we already waited for the button to not be there, so we can just check for the label
    const labels = screen.queryAllByText(labelText);
    expect(labels).toHaveLength(0);
    const buttons = screen.queryAllByText(buttonText);
    expect(buttons).toHaveLength(0);
  }

  it('does not render when feature not enabled', async function () {
    initComponentEnvironment({hasFeature: false, hasRule: false});

    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />
    );
    await expectNotToRender();
    // check we didn't call the endpoint to check if a rule exists for no reason
    expect(getRuleMock).toHaveBeenCalledTimes(0);
  });

  it('does not render when enough samples are present', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});

    render(
      <InvestigationRuleCreation
        buttonProps={{}}
        eventView={eventView}
        numSamples={10} // enough samples not to render the InvestigationRule component
      />,
      {organization}
    );
    await expectNotToRender();
    // check we didn't call the endpoint to check if a rule exists for no reason
    expect(getRuleMock).toHaveBeenCalledTimes(0);
  });

  it('shows a button when not enough samples are present and there is no rule', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});
    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );
    // wait for the button to appear
    const button = await screen.findByRole('button', {name: buttonText});
    expect(button).toBeInTheDocument();
    // make sure we are not showing the label
    const labels = screen.queryAllByText(labelText);
    expect(labels).toHaveLength(0);

    // check we did call the endpoint to check if a rule exists
    expect(getRuleMock).toHaveBeenCalledTimes(1);
  });

  it('shows a label when not enough samples are present and there is a rule', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: true});
    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );
    // wait for the label to appear
    const label = await screen.findByText(labelText);
    expect(label).toBeInTheDocument();
    // make sure we are not showing the button
    const buttons = screen.queryAllByText(buttonText);
    expect(buttons).toHaveLength(0);

    // check we did call the endpoint to check if a rule exists
    expect(getRuleMock).toHaveBeenCalledTimes(1);
  });

  it('does render disabled when the rule is not a transaction rule', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});
    const getRule = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'GET',
      statusCode: 400,
      body: {query: ['not_transaction_query']},
    });
    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );

    // wait for the button to appear
    const button = await screen.findByRole('button', {name: buttonText});
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    // we should  not be showing the label
    const labels = screen.queryAllByText(labelText);
    expect(labels).toHaveLength(0);

    expect(addErrorMessage).not.toHaveBeenCalled();
    // check we did call the endpoint to check if a rule exists
    expect(getRule).toHaveBeenCalledTimes(1);
  });

  it('does not render when there is an unknown error but shows an error', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});
    const getRule = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'GET',
      statusCode: 400,
      body: {query: ['some-unknown-error']},
    });
    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );
    await expectNotToRender();

    expect(addErrorMessage).toHaveBeenCalledTimes(1);
    // check we did call the endpoint to check if a rule exists
    expect(getRule).toHaveBeenCalledTimes(1);
  });

  it('should create a new rule when clicking on the button and update the UI', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});
    const createRule = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'POST',
      statusCode: 200,
      body: getCustomRule(),
    });

    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );

    // wait for the button to appear
    const button = await screen.findByRole('button', {name: buttonText});
    expect(button).toBeInTheDocument();
    // we should  not be showing the label
    const labels = screen.queryAllByText(labelText);
    expect(labels).toHaveLength(0);
    // now the user creates a rule
    // prepare a response with the created rule
    const sencondResponse = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'GET',
      statusCode: 200,
      body: getCustomRule(),
    });
    await userEvent.click(button);
    expect(createRule).toHaveBeenCalledTimes(1);
    // now we should have a rule and therefore display the notification label
    // wait for the label to appear
    const label = await screen.findByText(labelText);
    expect(label).toBeInTheDocument();
    // make sure we are not showing the button anymore
    const buttons = screen.queryAllByText(buttonText);
    expect(buttons).toHaveLength(0);
    // check we did call the endpoint to check if the newly created rule exists
    expect(sencondResponse).toHaveBeenCalledTimes(1);
  });

  it('should show an error when creating a new rule fails', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});
    const createRule = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'POST',
      statusCode: 400,
      body: {query: ['some-error']},
    });

    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );

    // wait for the button to appear
    const button = await screen.findByRole('button', {name: buttonText});
    expect(button).toBeInTheDocument();
    // we should  not be showing the label
    const labels = screen.queryAllByText(labelText);
    expect(labels).toHaveLength(0);
    // now the user creates a rule
    await userEvent.click(button);

    expect(createRule).toHaveBeenCalledTimes(1);
    // we should show some error that the rule could not be created
    expect(addErrorMessage).toHaveBeenCalledWith('Unable to create investigation rule');
  });

  it('should show notify the user when too many rules have been created', async function () {
    initComponentEnvironment({hasFeature: true, hasRule: false});
    const createRule = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      method: 'POST',
      statusCode: 429,
      body: {query: ['some-error']},
    });

    render(
      <InvestigationRuleCreation buttonProps={{}} eventView={eventView} numSamples={1} />,
      {organization}
    );

    // wait for the button to appear
    const button = await screen.findByRole('button', {name: buttonText});
    expect(button).toBeInTheDocument();
    // we should  not be showing the label
    const labels = screen.queryAllByText(labelText);
    expect(labels).toHaveLength(0);
    // now the user creates a rule
    await userEvent.click(button);

    expect(createRule).toHaveBeenCalledTimes(1);
    // we should show some error that the rule could not be created
    expect(addErrorMessage).toHaveBeenCalledWith(
      'You have reached the maximum number of concurrent investigation rules allowed'
    );
  });
});
