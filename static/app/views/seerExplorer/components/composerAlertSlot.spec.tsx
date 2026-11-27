import {getComposerAlert, type ComposerAlertState} from './composerAlertSlot';
import type {PendingUserInputPrompt} from './pendingUserInputDock';

const noAlerts: ComposerAlertState = {
  hasRequestError: false,
  isAutofixOutOfCredits: false,
  isComposerShown: true,
  isOutOfCredits: false,
  isRestartPending: false,
  isTimedOut: false,
  pendingUserInputPrompt: null,
  showSlackReminder: false,
  showSlackUpgrade: false,
};

const prompt: PendingUserInputPrompt = {
  type: 'connect_scm',
  pendingInput: {id: 'input-1', input_type: 'connect_scm', data: {}},
};

const everyAlert: ComposerAlertState = {
  hasRequestError: true,
  isAutofixOutOfCredits: true,
  isComposerShown: true,
  isOutOfCredits: true,
  isRestartPending: true,
  isTimedOut: true,
  pendingUserInputPrompt: prompt,
  showSlackReminder: true,
  showSlackUpgrade: true,
};

describe('getComposerAlert', () => {
  it('returns null when nothing applies', () => {
    expect(getComposerAlert(noAlerts)).toBeNull();
  });

  it('shows one alert at a time, most pressing first', () => {
    const state = {...everyAlert};
    const shown: string[] = [];
    for (const key of [
      'pendingUserInputPrompt',
      'isOutOfCredits',
      'isAutofixOutOfCredits',
      'isRestartPending',
      'hasRequestError',
      'isTimedOut',
      'showSlackUpgrade',
      'showSlackReminder',
    ] as const) {
      shown.push(getComposerAlert(state)?.type ?? 'none');
      Object.assign(state, {[key]: noAlerts[key]});
    }
    shown.push(getComposerAlert(state)?.type ?? 'none');

    expect(shown).toEqual([
      'pending input',
      'out of credits',
      'autofix out of credits',
      'restart',
      'request error',
      'timed out',
      'slack upgrade',
      'slack reminder',
      'none',
    ]);
  });

  it('carries the pending prompt', () => {
    expect(getComposerAlert(everyAlert)).toEqual({type: 'pending input', prompt});
  });

  it('skips credit and restart notices while the composer is hidden', () => {
    expect(
      getComposerAlert({
        ...noAlerts,
        isComposerShown: false,
        isOutOfCredits: true,
        isAutofixOutOfCredits: true,
        isRestartPending: true,
        isTimedOut: true,
      })
    ).toEqual({type: 'timed out'});
  });
});
