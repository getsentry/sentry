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
});
