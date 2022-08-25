import {InjectedRouter} from 'react-router';

import {speakPhrase} from './speechSynthesis';
import {FuzzyCommand, HierarchicalCommand} from './voiceAssistParser';

export const recognitionCommands = [
  new FuzzyCommand('navigate_settings', ['navigate', 'go'], ['settings', 'setting']),
  new FuzzyCommand('navigate_projects', ['navigate', 'go'], ['projects']),
  new FuzzyCommand('navigate_performance', ['navigate', 'go'], ['performance']),
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
];

// Mapping

export function getRecognitionActionMapping(
  router: InjectedRouter,
  params: any
): {[id: string]: () => void} {
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
    navigate_project_keys: () => {
      router.push({
        pathname: `/settings/${params.orgId}/projects/${params.projectId}/keys/`,
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
      apdexOptionDiv.style.backgroundColor = 'lightgray';

      await sleep(1000);
      apdexOptionDiv.click();
      await sleep(500);

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
      apdexOptionDiv.style.backgroundColor = 'lightgray';

      await sleep(1000);
      apdexOptionDiv.click();
      await sleep(500);

      const perfPanel = document.querySelector(
        'div[data-test-id="performance-widget-container"]'
      ) as HTMLDivElement;
      const userMiseryScore =
        perfPanel.children[0].children[0].children[1].children[0].textContent;

      speakPhrase(`Your user misery score is ${userMiseryScore}`);
    },
  };
}

function elementContainsText(selector, text) {
  const elements = document.querySelectorAll(selector);
  return Array.prototype.filter.call(elements, function (element) {
    return RegExp(text).test(element.textContent);
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/*

/// Navigation

// Settings page

router.push({
  pathname: `/settings/${orgId}/`,
  query: {},
});

// Project page

router.push({
  pathname: `/organizations/${orgId}/projects/`,
  query: {},
});

// Discover

router.push({
  pathname: `/organizations/${orgId}/discover/queries/`,
  query: {},
});

// DSN page

router.push({
  pathname: `/settings/${orgId}/projects/${projectId}/keys/`,
  query: {},
});

// Performance page

router.push({
  pathname: `/organizations/${orgId}/performance/`,
  query: {},
});

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
