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
      <SdkUpdateAlert projectId={project.id} minVersion="1.0.0" />,
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
      <SdkUpdateAlert projectId={project.id} minVersion="1.0.0" />,
      {organization}
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders alert when SDK version is below minimum with current version', async () => {
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

    render(<SdkUpdateAlert projectId={project.id} minVersion="2.0.0" />, {
      organization,
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "We've detected you're using sentry-sdk at version 1.0.0, which is below the minimum required version 2.0.0. Please update your SDK to enable agent monitoring."
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert with JavaScript SDK package name', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.javascript.nextjs',
          sdkVersion: '7.0.0',
        },
      ],
    });

    render(<SdkUpdateAlert projectId={project.id} minVersion="8.0.0" />, {
      organization,
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "We've detected you're using @sentry/nextjs at version 7.0.0, which is below the minimum required version 8.0.0. Please update your SDK to enable agent monitoring."
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert with fallback SDK name when package name cannot be determined', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.unknown',
          sdkVersion: '1.0.0',
        },
      ],
    });

    render(<SdkUpdateAlert projectId={project.id} minVersion="2.0.0" />, {
      organization,
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "We've detected you're using an SDK at version 1.0.0, which is below the minimum required version 2.0.0. Please update your SDK to enable agent monitoring."
        )
      )
    ).toBeInTheDocument();
  });

  it('renders alert without current version when sdkVersion is empty', async () => {
    renderMockSdkUpdateRequest({
      organization,
      body: [
        {
          projectId: project.id,
          sdkName: 'sentry.python',
          sdkVersion: '',
        },
      ],
    });

    render(<SdkUpdateAlert projectId={project.id} minVersion="2.0.0" />, {
      organization,
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "We've detected you're using sentry-sdk, which is below the minimum required version 2.0.0. Please update your SDK to enable agent monitoring."
        )
      )
    ).toBeInTheDocument();
  });
});
