import * as Sentry from '@sentry/react';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ImpactAssessment} from 'sentry/types/group';

import {ImpactFeedback} from './impactFeedback';

describe('ImpactFeedback', () => {
  const group = GroupFixture();

  function makeImpact(runUuid: string): ImpactAssessment {
    return {
      score: 73.5,
      level: 'high',
      description: 'Users cannot submit an order.',
      citations: [],
      sourceEventId: '7f4b9a95abc449a8a5afc3d1d2683a8b',
      runUuid,
      promptVersion: '3',
    };
  }

  it('sends positive feedback', async () => {
    render(<ImpactFeedback impact={makeImpact('run-uuid')} group={group} />);

    await userEvent.click(
      screen.getByRole('button', {name: 'Yes, this assessment is correct'})
    );

    expect(Sentry.captureFeedback).toHaveBeenCalledWith({
      message: 'Impact assessment is correct: high 73.5.',
      source: 'issue_details.impact_assessment.correction',
      tags: {
        'feedback.source': 'issue_details.impact_assessment.correction',
        'impact.verdict': 'positive',
        'impact.level': 'high',
        'impact.score': 73.5,
        'impact.corrected_level': null,
        'impact.run_uuid': 'run-uuid',
        'impact.prompt_version': '3',
        group_id: group.id,
      },
    });
    expect(screen.getByText('Thanks for the feedback!')).toBeInTheDocument();
  });

  it('sends a correction with a required note', async () => {
    render(<ImpactFeedback impact={makeImpact('run-uuid-2')} group={group} />);

    await userEvent.click(
      screen.getByRole('button', {name: 'No, this assessment is incorrect'})
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'What should the level be?'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Low'}));
    expect(screen.getByRole('button', {name: 'Send'})).toBeDisabled();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'What did the assessment get wrong?'}),
      'Orders retry automatically.'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(Sentry.captureFeedback).toHaveBeenCalledWith({
      message: 'Should be low (was high 73.5). Orders retry automatically.',
      source: 'issue_details.impact_assessment.correction',
      tags: {
        'feedback.source': 'issue_details.impact_assessment.correction',
        'impact.verdict': 'negative',
        'impact.level': 'high',
        'impact.score': 73.5,
        'impact.corrected_level': 'low',
        'impact.run_uuid': 'run-uuid-2',
        'impact.prompt_version': '3',
        group_id: group.id,
      },
    });
    expect(screen.getByText('Thanks for the feedback!')).toBeInTheDocument();
  });
});
