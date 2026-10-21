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

it('keeps oversized code visible without requesting a summary', () => {
  const request = MockApiClient.addMockResponse({url: URL, method: 'POST'});
  const code = 'x'.repeat(4_001);

  render(<CodeModeDetails projectId={1} code={code} language="python" />);

  expect(
    screen.getByText(
      (_, element) => element?.tagName === 'CODE' && element.textContent === code
    )
  ).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
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
