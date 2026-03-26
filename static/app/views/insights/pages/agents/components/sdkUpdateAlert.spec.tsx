import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {Organization} from 'sentry/types/organization';

import {SdkUpdateAlert} from './sdkUpdateAlert';

function renderMockSdkUpdateRequest({
  organization,
  body,
  statusCode,
}: {
  body:
    | Array<{
        projectId: string;
        sdkName: string;
        sdkVersion: string;
        suggestions?: Array<{type: string; newSdkVersion?: string}>;
      }>
    | {
        detail: string;
      };
  organization: Organization;
  statusCode?: number;
}) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdk-updates/`,
    method: 'GET',
    statusCode,
    body,
  });
}

describe('SdkUpdateAlert', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not render when SDK version is above minimum', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.python',
          sdkVersion: '3.0.0',
        },
      ],
    });

    const {container} = render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="1.0.0"
        packageName="sentry-sdk"
      />,
      {organization}
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('does not render when there is an error', async () => {
    renderMockSdkUpdateRequest({
      organization,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const {container} = render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="1.0.0"
        packageName="sentry-sdk"
      />,
      {organization}
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders alert when Python SDK version is below minimum', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.python',
          sdkVersion: '1.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '2.5.0'}],
        },
      ],
    });

    render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="2.0.0"
        packageName="sentry-sdk"
      />,
      {organization}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Your sentry-sdk version is below the minimum required for agent monitoring.'
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('Update to 2.5.0 or later.'))
    ).toBeInTheDocument();
  });

  it('renders alert when JavaScript SDK version is below minimum', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.javascript.nextjs',
          sdkVersion: '7.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '8.5.0'}],
        },
      ],
    });

    render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="8.0.0"
        packageName="@sentry/nextjs"
      />,
      {organization}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Your @sentry/nextjs version is below the minimum required for agent monitoring.'
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('Update to 8.5.0 or later.'))
    ).toBeInTheDocument();
  });

  it('renders alert when Node SDK version is below minimum', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.javascript.node',
          sdkVersion: '9.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '10.5.0'}],
        },
      ],
    });

    render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="10.0.0"
        packageName="@sentry/node"
      />,
      {organization}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Your @sentry/node version is below the minimum required for agent monitoring.'
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('Update to 10.5.0 or later.'))
    ).toBeInTheDocument();
  });

  it('does not render when only a non-matching SDK has updates', async () => {
    // Reproduces a real scenario: a Flask project also receives Rust events.
    // The Rust SDK has an update suggestion but the Flask SDK is up-to-date.
    // The alert should not display the Rust update for a Flask project.
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.rust',
          sdkVersion: '0.41.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '0.47.0'}],
        },
      ],
    });

    const {container} = render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="2.0.0"
        packageName="sentry-sdk"
      />,
      {organization}
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders alert when one SDK is outdated and another is up-to-date', async () => {
    // A project can receive events from multiple SDKs (e.g. Python + Node).
    // If the Python SDK is outdated but the Node SDK is up-to-date, the alert
    // should still display for the outdated Python SDK.
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.python',
          sdkVersion: '1.0.0',
          suggestions: [{type: 'updateSdk', newSdkVersion: '2.5.0'}],
        },
        {
          projectId: project.id,
          sdkName: 'sentry.javascript.node',
          sdkVersion: '10.0.0',
        },
      ],
    });

    render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="2.0.0"
        packageName="sentry-sdk"
      />,
      {organization}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Your sentry-sdk version is below the minimum required for agent monitoring.'
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('Update to 2.5.0 or later.'))
    ).toBeInTheDocument();
  });

  it('renders alert without suggested version when suggestions are not available', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.python',
          sdkVersion: '1.0.0',
        },
      ],
    });

    render(
      <SdkUpdateAlert
        projectId={project.id}
        minVersion="2.0.0"
        packageName="sentry-sdk"
      />,
      {organization}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Your sentry-sdk version is below the minimum required for agent monitoring.'
        )
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/Update to the latest version\./)).toBeInTheDocument();
  });
});
// trivial change for CI testing
