import * as Sentry from '@sentry/react';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, cleanup, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ImpactBadge} from './impactBadge';
import type {AssessedImpact} from './utils';

describe('ImpactBadge', () => {
  const group = GroupFixture();
  const impact: AssessedImpact = {
    level: 'low',
    score: 20,
    description: 'Few users are affected.',
    citations: [],
    sourceEventId: 'event-id',
    runUuid: null,
    promptVersion: null,
  };

  afterEach(() => {
    try {
      cleanup();
      act(() => {
        jest.runOnlyPendingTimers();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the assessment in the hovercard', async () => {
    jest.useFakeTimers();
    render(<ImpactBadge impact={impact} group={group} hovercard />, {
      organization: OrganizationFixture({features: ['seer-impact-assessment']}),
    });

    await userEvent.hover(screen.getByText('Low (20)'), {delay: null});
    act(() => jest.advanceTimersByTime(300));

    expect(screen.getByText('Few users are affected.')).toBeInTheDocument();
    expect(screen.getByText(/This issue has a/)).toHaveTextContent(
      'This issue has a Low impact on users'
    );
    expect(
      screen.queryByRole('button', {name: 'No, this assessment is incorrect'})
    ).not.toBeInTheDocument();
  });

  it('does not open a hovercard when disabled', async () => {
    jest.useFakeTimers();
    render(<ImpactBadge impact={impact} />);

    await userEvent.hover(screen.getByText('Low (20)'), {delay: null});
    act(() => jest.advanceTimersByTime(300));

    expect(screen.queryByText('Few users are affected.')).not.toBeInTheDocument();
  });

  it('stays open while sending a correction', async () => {
    jest.useFakeTimers();
    render(<ImpactBadge impact={impact} group={group} hovercard />, {
      organization: OrganizationFixture({
        features: ['seer-impact-assessment', 'seer-impact-assessment-feedback'],
      }),
    });

    await userEvent.hover(screen.getByText('Low (20)'), {delay: null});
    act(() => jest.advanceTimersByTime(300));
    await userEvent.click(
      screen.getByRole('button', {name: 'No, this assessment is incorrect'}),
      {delay: null}
    );
    // Moving the pointer away would normally close the hovercard.
    await userEvent.unhover(screen.getByText('Low (20)'), {delay: null});
    act(() => jest.advanceTimersByTime(300));
    await userEvent.click(
      screen.getByRole('button', {name: 'What should the level be?'}),
      {delay: null}
    );
    await userEvent.click(screen.getByRole('option', {name: 'High'}), {delay: null});
    await userEvent.type(
      screen.getByRole('textbox', {name: 'What did the assessment get wrong?'}),
      'Every checkout fails.',
      {delay: null}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Send'}), {delay: null});

    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Should be high (was low 20). Every checkout fails.',
      })
    );
    expect(screen.getByText('Thanks for the feedback!')).toBeInTheDocument();
  });
});
