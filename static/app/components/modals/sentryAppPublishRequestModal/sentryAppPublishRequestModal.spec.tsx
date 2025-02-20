import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import {
  getPermissionSelectionsFromScopes,
  SentryAppPublishRequestModal,
} from 'sentry/components/modals/sentryAppPublishRequestModal/sentryAppPublishRequestModal';

describe('SentryAppDetailsModal', function () {
  const styledWrapper = styled((c: PropsWithChildren) => c.children);
  const sentryApp = SentryAppFixture();
  const onPublishSubmission = jest.fn();
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the modal', function () {
    render(
      <SentryAppPublishRequestModal
        closeModal={jest.fn()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={OrganizationFixture()}
        app={sentryApp}
        onPublishSubmission={onPublishSubmission}
      />
    );

    expect(screen.getByText('Publish Request Questionnaire')).toBeInTheDocument();
    expect(screen.getByText('Questions to answer')).toBeInTheDocument();
    expect(screen.getByText('What value does it offer customers?')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'By submitting your integration, you acknowledge and agree that Sentry reserves the right to remove it at any time in its sole discretion.'
      )
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request Publication'})).toBeInTheDocument();
  });

  it('renders new modal questions when feature flag is true', () => {
    const organization = OrganizationFixture({
      features: [`streamlined-publishing-flow`],
    });

    render(
      <SentryAppPublishRequestModal
        closeModal={jest.fn()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={organization}
        app={sentryApp}
        onPublishSubmission={onPublishSubmission}
      />
    );

    expect(screen.getByText('Publish Request Questionnaire')).toBeInTheDocument();
    expect(screen.getByText('Questions to answer')).toBeInTheDocument();
    expect(screen.getByText('Link to your documentation page.')).toBeInTheDocument();
    expect(
      screen.queryByText('What value does it offer customers?')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'By submitting your integration, you acknowledge and agree that Sentry reserves the right to remove it at any time in its sole discretion.'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Request Publication'})).toBeInTheDocument();
  });
  it('sends correctly formatted JSON for the new modal flow', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
      method: 'POST',
    });
    const organization = OrganizationFixture({
      features: [`streamlined-publishing-flow`],
    });

    render(
      <SentryAppPublishRequestModal
        closeModal={jest.fn()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={organization}
        app={sentryApp}
        onPublishSubmission={onPublishSubmission}
      />
    );

    // Fill out the form fields
    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
      }),
      'ok'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations .',
      }),
      'the coolest integration ever'
    );

    await userEvent.click(
      screen.getByRole('textbox', {
        name: 'Select what category best describes your integration. Documentation for reference.',
      })
    );

    expect(screen.getByText('Deployment')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Deployment'));

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Link to your documentation page.',
      }),
      'http://example.com'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Link to a video showing installation, setup and user flow for your submission. Examples include: Google Drive & Youtube',
      }),
      'https://example.com'
    );

    const submitButton = screen.getByRole('button', {name: 'Request Publication'});
    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    // we refetch the deets on closing of modal
    expect(onPublishSubmission).toHaveBeenCalledTimes(1);

    // Verify the API was called with the correct payload
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [url, {method, data}] = mockRequest.mock.calls[0];
    expect(url).toBe(`/sentry-apps/${sentryApp.slug}/publish-request/`);
    expect(method).toBe('POST');
    expect(data).toEqual({
      questionnaire: expect.arrayContaining([
        {
          question:
            'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
          answer: 'ok',
        },
        {
          question:
            'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations.',
          answer: 'the coolest integration ever',
        },
        {
          question: 'Select what category best describes your integration.',
          answer: 'deployment',
        },
        {
          question: 'Link to your documentation page.',
          answer: 'http://example.com',
        },
        {
          question:
            'Link to a video showing installation, setup and user flow for your submission. Examples include: Google Drive & Youtube',
          answer: 'https://example.com',
        },
      ]),
    });
  });
  it('sends correctly formatted JSON for the old modal flow', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
      method: 'POST',
    });

    render(
      <SentryAppPublishRequestModal
        closeModal={jest.fn()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={OrganizationFixture()}
        app={sentryApp}
        onPublishSubmission={onPublishSubmission}
      />
    );

    // Fill out the form fields
    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'What does your integration do? Please be as detailed as possible.',
      }),
      'ok'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'What value does it offer customers?',
      }),
      'everything'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Do you operate the web service your integration communicates with?',
      }),
      'maybe'
    );

    const permissionInput = screen.getByRole('textbox', {
      name: /Please justify why you are requesting each of the following permissions/,
    });

    await userEvent.type(permissionInput, 'monka');

    const submitButton = screen.getByRole('button', {name: 'Request Publication'});
    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    // Get the exact text that was sent to the API
    const permissions = getPermissionSelectionsFromScopes(sentryApp.scopes);
    const permissionQuestionBaseText =
      'Please justify why you are requesting each of the following permissions: ';
    const permissionQuestionPlainText = `${permissionQuestionBaseText}${permissions.join(
      ', '
    )}.`;

    // Verify the API was called with the correct payload
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [url, {method, data}] = mockRequest.mock.calls[0];
    expect(url).toBe(`/sentry-apps/${sentryApp.slug}/publish-request/`);
    expect(method).toBe('POST');
    expect(data).toEqual({
      questionnaire: expect.arrayContaining([
        {
          question: 'What does your integration do? Please be as detailed as possible.',
          answer: 'ok',
        },
        {
          question: 'What value does it offer customers?',
          answer: 'everything',
        },
        {
          question: 'Do you operate the web service your integration communicates with?',
          answer: 'maybe',
        },
        {
          question: permissionQuestionPlainText,
          answer: 'monka',
        },
      ]),
    });
  });

  it('allows users to select a list of categories', async () => {
    const organization = OrganizationFixture({
      features: [`streamlined-publishing-flow`],
    });

    render(
      <SentryAppPublishRequestModal
        closeModal={jest.fn()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={organization}
        app={sentryApp}
        onPublishSubmission={onPublishSubmission}
      />
    );

    expect(
      screen.getByRole('textbox', {
        name: /Select what category best describes your integration/,
      })
    ).toBeInTheDocument();
    const categorySelect = screen.getByRole('textbox', {
      name: /Select what category best describes your integration/,
    });
    await userEvent.click(categorySelect);
    expect(screen.getByText('Source Code Management')).toBeInTheDocument();
    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
  });

  it('shows error message on failure', async () => {
    const errorMessage = 'Failed to submit publish request';
    const mockRequest = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: errorMessage},
    });
    const closeModal = jest.fn();

    render(
      <SentryAppPublishRequestModal
        closeModal={closeModal}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={OrganizationFixture()}
        app={sentryApp}
        onPublishSubmission={jest.fn()}
      />
    );

    // Fill out the form fields
    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'What does your integration do? Please be as detailed as possible.',
      }),
      'ok'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'What value does it offer customers?',
      }),
      'everything'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Do you operate the web service your integration communicates with?',
      }),
      'maybe'
    );

    const permissionInput = screen.getByRole('textbox', {
      name: /Please justify why you are requesting each of the following permissions/,
    });

    await userEvent.type(permissionInput, 'monka');

    const submitButton = screen.getByRole('button', {name: 'Request Publication'});
    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    // Verify modal stays open
    expect(closeModal).not.toHaveBeenCalled();
  });
  it('button is disabled if invalid urls are used', async () => {
    const organization = OrganizationFixture({
      features: [`streamlined-publishing-flow`],
    });

    render(
      <SentryAppPublishRequestModal
        closeModal={jest.fn()}
        Header={p => <span>{p.children}</span>}
        Footer={styledWrapper()}
        Body={styledWrapper()}
        CloseButton={makeCloseButton(() => {})}
        organization={organization}
        app={sentryApp}
        onPublishSubmission={onPublishSubmission}
      />
    );

    // Fill out the form fields
    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
      }),
      'ok'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations .',
      }),
      'the coolest integration ever'
    );

    await userEvent.click(
      screen.getByRole('textbox', {
        name: 'Select what category best describes your integration. Documentation for reference.',
      })
    );

    expect(screen.getByText('Deployment')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Deployment'));

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Link to your documentation page.',
      }),
      'omo'
    );

    await userEvent.type(
      screen.getByRole('textbox', {
        name: 'Link to a video showing installation, setup and user flow for your submission. Examples include: Google Drive & Youtube',
      }),
      'https://example.com'
    );

    const submitButton = screen.getByRole('button', {name: 'Request Publication'});
    expect(submitButton).toBeDisabled();
    expect(
      screen.getByText('Invalid link: URL must start with https://')
    ).toBeInTheDocument();
  });
});
