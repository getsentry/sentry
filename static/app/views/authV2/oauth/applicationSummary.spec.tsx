import {Fragment} from 'react';
import {OAuthContextFixture} from 'sentry-fixture/oauth';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ApplicationSummary} from './applicationSummary';
import {ConsentFooter} from './consentNotice';

jest.mock('sentry-images/oauth/sentry-cli.png', () => 'sentry-cli.png');
jest.mock('sentry-images/oauth/sentry-mcp.png', () => 'sentry-mcp.png');

it('shows granted access and special capabilities in a permission table', async () => {
  render(
    <ApplicationSummary
      context={OAuthContextFixture({
        permissionGroups: [
          {
            resource: 'projects',
            label: 'Projects',
            scopes: ['project:read'],
            actions: ['read'],
            accessDescriptions: {
              read: 'View projects and their settings.',
              write: 'Manage project settings and alert rules, including deleting them.',
              admin: 'Delete projects.',
            },
            description: null,
          },
          {
            resource: 'members',
            label: 'Members',
            scopes: ['member:invite'],
            actions: ['invite'],
            accessDescriptions: {
              read: 'View members.',
              write: 'Update memberships.',
              admin: 'Remove members.',
              invite: 'Invite organization members.',
            },
            description: null,
          },
          {
            resource: 'ci',
            label: 'CI workflows',
            scopes: ['org:ci'],
            actions: [],
            description: 'Upload source maps and create releases.',
          },
        ],
      })}
    />
  );

  const projects = screen.getByRole('row', {
    name: /Projects Granted Not granted Not granted/,
  });
  expect(within(projects).getByRole('img', {name: 'Granted'})).toBeInTheDocument();
  expect(within(projects).getAllByRole('img', {name: 'Not granted'})).toHaveLength(2);

  await userEvent.tab();
  await userEvent.tab();

  expect(screen.getByRole('rowgroup', {name: 'Permission list'})).toHaveFocus();

  await userEvent.tab();

  expect(within(projects).getByRole('img', {name: 'Granted'})).toHaveFocus();
  expect(
    await screen.findByText('View projects and their settings.')
  ).toBeInTheDocument();
  expect(
    within(projects).getByRole('img', {name: 'Granted'})
  ).toHaveAccessibleDescription('View projects and their settings.');

  const members = screen.getByRole('row', {name: /Members/});
  expect(within(members).getAllByRole('img', {name: 'Not granted'})).toHaveLength(3);

  const workflows = screen.getByRole('row', {name: /CI workflows/});
  expect(within(workflows).getAllByRole('cell', {name: 'Not applicable'})).toHaveLength(
    3
  );

  await userEvent.hover(within(workflows).getByRole('img', {name: 'Permission details'}));

  expect(
    await screen.findByText('Upload source maps and create releases.')
  ).toBeInTheDocument();
});

it('describes device-code confirmation when the badge receives keyboard focus', async () => {
  render(<ApplicationSummary context={OAuthContextFixture()} userCode="ABCD-EFGH" />);

  const badge = screen.getByRole('group', {name: 'Device code'});

  await userEvent.tab();
  await userEvent.tab();

  expect(badge).toHaveFocus();
  expect(
    await screen.findByText('Confirm that this code matches your device: ABCD-EFGH')
  ).toBeInTheDocument();
  expect(badge).toHaveAccessibleDescription(
    'Confirm that this code matches your device: ABCD-EFGH'
  );
});

it.each([
  ['https://example.com/privacy', null],
  [null, 'https://example.com/terms'],
  ['https://example.com/privacy', 'https://example.com/terms'],
])('links the application policies and revocation settings', (privacyUrl, termsUrl) => {
  render(
    <Fragment>
      <ConsentFooter
        application={{...OAuthContextFixture().application, privacyUrl, termsUrl}}
      />
    </Fragment>
  );

  expect(
    screen.getByRole('link', {name: 'Account → Authorized Applications'})
  ).toHaveAttribute('href', '/settings/account/authorizations/');

  const expected = [privacyUrl, termsUrl].filter(Boolean);

  expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
    '/settings/account/authorizations/',
    ...expected,
  ]);
});

it.each([
  ['1d673b81d60ef84c951359c36296972ca6fd41bd8f45acd2d3a783a3b3c28e41', true],
  ['32d744a577ea363284b996867923fa4eb0bfdfcfe6b46399f078f753b7bb84f1', true],
  ['other-client', false],
])('identifies Sentry applications by client ID %s', (clientId, isSentry) => {
  const context = OAuthContextFixture();
  render(
    <ApplicationSummary
      context={{
        ...context,
        application: {
          ...context.application,
          clientId,
          name: 'Sentry MCP',
          homepageUrl: 'https://sentry.io',
        },
      }}
    />
  );

  if (isSentry) {
    expect(screen.getByRole('img', {name: 'Sentry app'})).toBeInTheDocument();
  } else {
    expect(screen.queryByRole('img', {name: 'Sentry app'})).not.toBeInTheDocument();
  }
});

it('explains Sentry ownership when the badge receives keyboard focus', async () => {
  const context = OAuthContextFixture();
  render(
    <ApplicationSummary
      context={{
        ...context,
        application: {
          ...context.application,
          clientId: '32d744a577ea363284b996867923fa4eb0bfdfcfe6b46399f078f753b7bb84f1',
        },
      }}
    />
  );

  await userEvent.tab();

  const badge = screen.getByRole('img', {name: 'Sentry app'});
  expect(badge).toHaveFocus();
  expect(await screen.findByText('This app is built by Sentry.')).toBeInTheDocument();
  expect(badge).toHaveAccessibleDescription('This app is built by Sentry.');
});
