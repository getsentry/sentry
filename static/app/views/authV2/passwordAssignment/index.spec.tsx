import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import PasswordAssignment from './index';

const routerConfig = {
  location: {pathname: '/account/password/confirm/1/assignment-token/'},
  route: '/account/password/confirm/:userId/:token/',
};

jest.unmock('@tanstack/react-pacer');

describe('PasswordAssignment', () => {
  it.each(['/organizations/', '/auth/login/'])(
    'sets a password and follows %s',
    async nextUri => {
      const validate = MockApiClient.addMockResponse({
        url: '/auth/password/',
        body: {valid: true},
      });
      const assign = MockApiClient.addMockResponse({
        url: '/auth/password/',
        method: 'POST',
        body: {nextUri},
      });
      render(<PasswordAssignment />, {initialRouterConfig: routerConfig});
      await userEvent.type(
        await screen.findByLabelText('New password'),
        ' a-secure-password '
      );
      expect(screen.getByRole('heading', {name: 'Set Password'})).toBeVisible();
      await userEvent.click(screen.getByRole('button', {name: 'Set password'}));
      await waitFor(() =>
        expect(testableWindowLocation.assign).toHaveBeenCalledWith(nextUri)
      );
      expect(validate).toHaveBeenCalledWith(
        '/auth/password/',
        expect.objectContaining({query: {userId: '1', token: 'assignment-token'}})
      );
      expect(assign).toHaveBeenCalledWith(
        '/auth/password/',
        expect.objectContaining({
          data: {userId: '1', token: 'assignment-token', password: ' a-secure-password '},
        })
      );
    }
  );

  it('shows an expired assignment link', async () => {
    MockApiClient.addMockResponse({url: '/auth/password/', body: {valid: false}});
    render(<PasswordAssignment />, {initialRouterConfig: routerConfig});
    expect(
      await screen.findByText(
        'This password setup link is invalid or expired. Request a new link to continue.'
      )
    ).toBeVisible();
  });

  it('preserves the password when assignment validation fails', async () => {
    MockApiClient.addMockResponse({url: '/auth/password/', body: {valid: true}});
    MockApiClient.addMockResponse({
      url: '/auth/password/',
      method: 'POST',
      statusCode: 400,
      body: {password: ['This password is too short.']},
    });
    render(<PasswordAssignment />, {initialRouterConfig: routerConfig});
    await userEvent.type(await screen.findByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', {name: 'Set password'}));
    expect(await screen.findByText('This password is too short.')).toBeVisible();
    expect(screen.getByLabelText('New password')).toHaveValue('short');
  });

  it('handles a token that expires before submitting', async () => {
    MockApiClient.addMockResponse({url: '/auth/password/', body: {valid: true}});
    MockApiClient.addMockResponse({
      url: '/auth/password/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid or expired recovery token'},
    });
    render(<PasswordAssignment />, {initialRouterConfig: routerConfig});
    await userEvent.type(
      await screen.findByLabelText('New password'),
      'a-secure-password'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Set password'}));
    expect(
      await screen.findByText(
        'This password setup link is invalid or expired. Request a new link to continue.'
      )
    ).toBeVisible();
  });
});
