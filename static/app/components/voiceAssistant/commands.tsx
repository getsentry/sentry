/* eslint-disable no-console */
import {InjectedRouter} from 'react-router';

import {speakPhrase} from './speechSynthesis';
import {FuzzyCommand, HierarchicalCommand} from './voiceAssistParser';

interface VoiceActionContext {
  matchedAlternative: SpeechRecognitionAlternative;
  params: {[id: string]: string};
  router: InjectedRouter;
}

export function getVoiceActionById(
  actionId: string,
  context: VoiceActionContext
): () => void {
  const actionMapping = getRecognitionActionMapping(context);
  return actionMapping[actionId];
}

export const recognitionCommands = [
  new FuzzyCommand('navigate_settings', ['navigate', 'go'], ['settings', 'setting']),
  new FuzzyCommand('navigate_projects', ['navigate', 'go'], ['projects']),
  new FuzzyCommand('navigate_performance', ['navigate', 'go'], ['performance']),
  new FuzzyCommand('navigate_issues', ['navigate', 'go'], ['issues']),
  new FuzzyCommand(
    'navigate_project_keys',
    ['navigate', 'go', 'show', 'give'],
    ['DSN', 'GSM', 'DSM', 'key']
  ),
  new HierarchicalCommand(
    'show_apdex_score',
    ['what', 'how'],
    ['apdex', 'abdic', 'abdicks', 'objects', 'epic']
  ),
  new HierarchicalCommand(
    'show_user_misery',
    ['what', 'how'],
    ['user', 'users'],
    ['misery']
  ),
  new HierarchicalCommand(
    'go_first_project',
    ['go', 'navigate', 'open'],
    ['first'],
    ['project', 'projects']
  ),
  new HierarchicalCommand(
    'select_issue_from_list',
    ['open'],
    ['first', 'second', 'third', 'fourth', 'forth', 'fifth', 'sixth', 'last'],
    ['issue', 'issues']
  ),
];

// Mappings

function getRecognitionActionMapping(context: VoiceActionContext): {
  [id: string]: () => void;
} {
  const {matchedAlternative, router, params} = context;
  return {
    navigate_settings: () => {
      router.push({
        pathname: `/settings/${params.orgId}/`,
      });
    },
    navigate_projects: () => {
      router.push({
        pathname: `/organizations/${params.orgId}/projects/`,
      });
    },
    navigate_performance: () => {
      router.push({
        pathname: `/organizations/${params.orgId}/performance/`,
      });
    },
    navigate_issues: () => {
      router.push({
        pathname: `/organizations/${params.orgId}/issues/`,
      });
    },
    navigate_project_keys: () => {
      router.push({
        pathname: `/settings/${params.orgId}/projects/${params.projectId}/keys/`,
      });
    },
    go_first_project: () => {
      const projectSpan = document.querySelector(
        'span[data-test-id="badge-display-name"]'
      ) as HTMLSpanElement;
      const projectName = projectSpan.children[0].textContent as string;
      router.push({
        pathname: `/organizations/${params.orgId}/projects/${projectName}/`,
      });
    },
    show_apdex_score: async () => {
      const moreBtn = document.querySelector(
        'div[data-test-id="performance-widget-container"] button'
      ) as HTMLButtonElement;
      moreBtn.click();

      await sleep(1000);

      const apdexMenuPar = elementContainsText('div p', '^Apdex$')[0];
      const apdexOptionDiv = apdexMenuPar.parentElement.parentElement.parentElement
        .parentElement as HTMLDivElement;
      apdexOptionDiv.style.backgroundColor = '#F5F3F7';

      await sleep(1000);
      apdexOptionDiv.click();
      await sleep(1000);

      const perfPanel = document.querySelector(
        'div[data-test-id="performance-widget-container"]'
      ) as HTMLDivElement;
      const apdexScore =
        perfPanel.children[0].children[0].children[1].children[0].textContent;

      speakPhrase(`Your app dex score is ${apdexScore}`);
    },

    show_user_misery: async () => {
      const moreBtn = document.querySelector(
        'div[data-test-id="performance-widget-container"] button'
      ) as HTMLButtonElement;
      moreBtn.click();

      await sleep(1000);

      const apdexMenuPar = elementContainsText('div p', '^User Misery$')[0];
      const apdexOptionDiv = apdexMenuPar.parentElement.parentElement.parentElement
        .parentElement as HTMLDivElement;
      apdexOptionDiv.style.backgroundColor = '#F5F3F7';

      await sleep(1000);
      apdexOptionDiv.click();
      await sleep(1000);

      const perfPanel = document.querySelector(
        'div[data-test-id="performance-widget-container"]'
      ) as HTMLDivElement;
      const userMiseryScore =
        perfPanel.children[0].children[0].children[1].children[0].textContent;

      speakPhrase(`Your user misery score is ${userMiseryScore}`);
    },

    select_issue_from_list: () => {
      const recognizedText = matchedAlternative.transcript.toLowerCase();
      const words = recognizedText.split(' ');
      const issueNumber = findOrdinalFromWords(words);
      if (issueNumber) {
        const allIssues = document.querySelectorAll('div[data-test-id="group"]');
        const selectedIssue = allIssues[issueNumber - 1];
        const issueLink = selectedIssue.querySelector('a');
        if (issueLink) {
          issueLink.click();
        } else {
          console.log(`Cannot find the issue link`);
        }
      } else {
        console.log(`Invalid issue number! Recognized text: "${recognizedText}"`);
      }
    },
  };
}

// Helpers

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function elementContainsText(selector: string, text: string) {
  const elements = document.querySelectorAll(selector);
  return Array.prototype.filter.call(elements, function (element) {
    return RegExp(text).test(element.textContent);
  });
}

function findOrdinalFromWords(words: string[]): number | undefined {
  const wordMap = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    forth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    nineth: 9,
    tenth: 10,
  };

  for (const word of words) {
    const num = wordMap[word];
    if (num) {
      return num;
    }
  }

  return undefined;
}

/*

/// Actions

// Resolve the issue

btn = document.querySelector('button[aria-label="Resolve"]');
btn.click();

// Unresolve the issue

btn = document.querySelector('button[aria-label="Unresolve"]');
btn.click();

// Performance page: what is my apdex score? What is my user mysery
// Step 1: Switch to the proper graph
// Step 2: Speak

*/
