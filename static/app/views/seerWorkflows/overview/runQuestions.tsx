import {t} from 'sentry/locale';

interface RunQuestionConfig {
  key: string;
  label: string;
  // The prompt sent to the runs endpoint as a `question` param. Answered per
  // run over its full history by Seer's agent_question one-shot; editing the
  // text invalidates that (run, question) cache entry, so fresh answers show
  // on the next load. Prompts are universal and self-adapt to the run's stage;
  // "return an empty string" lets the UI skip sections that don't apply.
  prompt: string;
}

// The one-shot questions the overview asks about each run (the endpoint caps
// user questions at 5). Order matters: answers come back positionally.
export const RUN_QUESTIONS: RunQuestionConfig[] = [
  {
    key: 'root_cause',
    label: t('Root cause'),
    prompt:
      'Answer in two parts separated by a single pipe character. First a ' +
      'headline: at most 14 words of plain language describing what is broken ' +
      'and where, the way a good bug-report title would — no error class names ' +
      'unless essential, no markdown or code formatting, no pipe characters in ' +
      'it. ' +
      'Then the pipe. Then the root cause: ONE sentence of at most 25 words on ' +
      'why it breaks, naming the responsible function, commit, or ' +
      'configuration — the headline already covers what and where, so do not ' +
      'repeat it. Inline code is allowed in this part, but no headers, ' +
      'bullets, or code blocks. If the run did not establish a root cause, ' +
      'still give the headline, then the pipe, then one sentence on why it ' +
      'could not (e.g. could not reproduce, missing context).',
  },
  {
    key: 'fix_summary',
    label: t('Proposed fix'),
    prompt:
      'If this run drafted code changes or opened a pull request, describe in ' +
      'at most two sentences (max 45 words) what the changes are and why they ' +
      'fix the root cause — name the files or functions touched and the ' +
      'behavior change. Describe the change itself, never the author: no ' +
      'first person ("I modified…") and no narration like "the solution ' +
      'modifies" — e.g. "Adds an early return in `captureMcpShutdownSummary` ' +
      'so info-level shutdowns no longer create issues." If the run did not ' +
      'produce code changes, return an empty string. Inline code allowed for ' +
      'file or function names; no markdown headers, bullets, or code blocks.',
  },
  {
    key: 'next_steps',
    label: t('Next steps'),
    prompt:
      'If this run drafted code changes or opened a pull request, return an ' +
      'empty string. Otherwise: ONE sentence of at most 25 words — the single ' +
      'highest-leverage next step for an engineer (what to confirm, decide, ' +
      'or investigate), concrete and specific to this issue. Never tell the ' +
      'reader to have Seer or an AI generate the fix — the product already ' +
      'offers that as a button next to these notes; if generating code is the ' +
      'obvious next move, state what the fix should do instead. No first ' +
      'person; no markdown bullets or headers; inline code allowed.',
  },
];

export const RUN_QUESTION_PROMPTS = RUN_QUESTIONS.map(question => question.prompt);
