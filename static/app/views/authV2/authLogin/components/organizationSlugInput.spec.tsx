import {QueryClientProvider} from '@tanstack/react-query';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationSlugInput} from './organizationSlugInput';

describe('OrganizationSlugInput', () => {
  it('selects the located organization', async () => {
    const onSelect = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'dummy', name: 'Dummy'},
        warnings: [],
      },
    });
    render(<OrganizationSlugInput onCancel={jest.fn()} onSelect={onSelect} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Organization Slug'}),
      'acme'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('acme'));
  });

  it('latches an invalid organization until the slug changes', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/auth/organizations/missing/config/',
      statusCode: 404,
      body: {detail: 'Organization not found'},
    });
    const onCancel = jest.fn();
    const onSelect = jest.fn();
    const {rerender} = render(
      <OrganizationSlugInput onCancel={onCancel} onSelect={onSelect} />
    );

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});
    await userEvent.type(input, 'missing');
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('Organization not found');
    expect(input).toHaveAccessibleDescription('Organization not found');
    await waitFor(() =>
      expect(document.querySelector('[data-tooltip]')).toHaveTextContent(
        'Organization not found'
      )
    );
    expect(screen.queryByRole('button', {name: 'Locate'})).not.toBeInTheDocument();
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveProperty('selectionStart', 0);
    expect(input).toHaveProperty('selectionEnd', 'missing'.length);

    const cancelButton = screen.getByRole('button', {name: 'Cancel organization SSO'});
    await userEvent.click(cancelButton);
    rerender(<OrganizationSlugInput onCancel={onCancel} onSelect={onSelect} />);
    expect(cancelButton).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(request).toHaveBeenCalledTimes(1);

    await userEvent.type(input, '-new');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Locate'})).toBeInTheDocument();
  });

  it('allows a failed organization lookup to be retried', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      statusCode: 503,
      body: {detail: 'Organization authentication is temporarily unavailable'},
    });
    render(<OrganizationSlugInput onCancel={jest.fn()} onSelect={jest.fn()} />);

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});
    await userEvent.type(input, 'acme');
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load organization authentication. Please try again.'
    );
    expect(
      screen.getByRole('textbox', {name: 'Organization Slug'})
    ).toHaveAccessibleDescription(
      'Unable to load organization authentication. Please try again.'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveProperty('selectionStart', 0);
    expect(input).toHaveProperty('selectionEnd', 'acme'.length);
  });

  it('does not select stale cached data when its refetch fails', async () => {
    const queryClient = makeTestQueryClient();
    const queryOptions = apiOptions.as<AuthOrganization>()(
      '/auth/organizations/$organizationIdOrSlug/config/',
      {path: {organizationIdOrSlug: 'acme'}, staleTime: 0}
    );
    queryClient.setQueryData(queryOptions.queryKey, {
      headers: {},
      json: {
        authenticated: false,
        memberAuthenticated: false,
        canRegister: false,
        joinRequestUrl: null,
        loginMethod: 'sso',
        ssoRequired: true,
        organization: {avatarUrl: null, name: 'Acme', slug: 'acme'},
        provider: {key: 'dummy', name: 'Dummy'},
        warnings: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      statusCode: 503,
      body: {detail: 'Organization authentication is temporarily unavailable'},
    });
    const onSelect = jest.fn();
    render(<OrganizationSlugInput onCancel={jest.fn()} onSelect={onSelect} />, {
      additionalWrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Organization Slug'}),
      'acme'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load organization authentication. Please try again.'
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('exits organization selection', async () => {
    const onCancel = jest.fn();
    render(<OrganizationSlugInput onCancel={onCancel} onSelect={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Cancel organization SSO'}));

    expect(onCancel).toHaveBeenCalled();
  });

  it('allows organization selection to be canceled while locating', async () => {
    const lookup = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      asyncDelay: lookup.promise,
      body: {},
    });
    const onCancel = jest.fn();
    render(<OrganizationSlugInput onCancel={onCancel} onSelect={jest.fn()} />);

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});
    await userEvent.type(input, 'acme');
    await userEvent.click(screen.getByRole('button', {name: 'Locate'}));
    expect(input).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('button', {name: 'Cancel organization SSO'}));

    expect(onCancel).toHaveBeenCalled();
    lookup.resolve();
  });
});
