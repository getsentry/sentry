import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {CodeModeDetails} from './codeModeDetails';

const URL = '/projects/org-slug/1/ai/code-explanation/';
const CODE = '  print(42)\n';

beforeEach(() => {
  MockApiClient.clearMockResponses();
});

it('does not request a summary when AI features are hidden', () => {
  const request = MockApiClient.addMockResponse({url: URL, method: 'POST'});

  render(<CodeModeDetails projectId={1} code={CODE} language="python" />, {
    organization: OrganizationFixture({hideAiFeatures: true}),
  });

  expect(screen.getByRole('button', {name: 'Copy snippet'})).toBeInTheDocument();
  expect(screen.queryByRole('heading', {name: 'Summary'})).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});

it('requests a summary for the first 4,000 characters of oversized code', async () => {
  const code = `${'x'.repeat(3_999)}🙂${'y'.repeat(10)}`;
  const request = MockApiClient.addMockResponse({
    url: URL,
    method: 'POST',
    body: {summary: 'Prints values.'},
    match: [
      MockApiClient.matchData({code: `${'x'.repeat(3_999)}🙂`, language: 'python'}),
    ],
  });

  render(<CodeModeDetails projectId={1} code={code} language="python" />);

  expect(await screen.findByText('Prints values.')).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText(
      (_, element) => element?.tagName === 'CODE' && element.textContent === code
    )
  ).toBeInTheDocument();
});

it('keeps code available when generation fails', async () => {
  const request = MockApiClient.addMockResponse({
    url: URL,
    method: 'POST',
    statusCode: 502,
    body: {detail: 'Unable to generate a code explanation.'},
  });

  render(<CodeModeDetails projectId={1} code={CODE} language="python" />);

  await waitForElementToBeRemoved(() => screen.queryByRole('region', {name: 'Summary'}));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', {name: 'Copy snippet'})).toBeInTheDocument();
  expect(screen.queryByRole('heading', {name: 'Summary'})).not.toBeInTheDocument();
});
