import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {captureProjectCreationFailure} from 'sentry/components/onboarding/captureProjectCreationFailure';

describe('captureProjectCreationFailure', () => {
  const organization = OrganizationFixture();
  const accessTeams = [TeamFixture({slug: 'team-slug', access: ['team:admin']})];

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a generic failure', () => {
    const captureMessage = jest.spyOn(Sentry, 'captureMessage');

    captureProjectCreationFailure({
      error: {status: 500},
      organization,
      team: 'team-slug',
      accessTeams,
      variant: 'scm',
    });

    expect(captureMessage).toHaveBeenCalledWith('Project creation failed');
  });

  it('reports permission denials under their own message', () => {
    const captureMessage = jest.spyOn(Sentry, 'captureMessage');

    captureProjectCreationFailure({
      error: {status: 403},
      organization,
      team: 'team-slug',
      accessTeams,
      variant: 'legacy',
    });

    expect(captureMessage).toHaveBeenCalledWith('Project creation permission denied');
  });

  it('does not report a duplicate project name', () => {
    const captureMessage = jest.spyOn(Sentry, 'captureMessage');

    captureProjectCreationFailure({
      error: {status: 409},
      organization,
      team: 'team-slug',
      accessTeams,
      variant: 'scm',
    });

    expect(captureMessage).not.toHaveBeenCalled();
  });
});
