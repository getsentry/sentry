import {InjectedRouter} from 'react-router';

import {FuzzyCommand} from './voiceAssistParser';

export const recognitionCommands = [
  new FuzzyCommand('navigate_settings', ['navigate', 'go'], ['settings', 'setting']),
  new FuzzyCommand('navigate_projects', ['navigate', 'go'], ['projects']),
  new FuzzyCommand(
    'navigate_project_keys',
    ['navigate', 'go', 'show', 'give'],
    ['DSN', 'GSM', 'DSM', 'key']
  ),
  // new FuzzyCommand('navigate_dsn', ['navigate', 'go'], ['dsn']),
];

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
    navigate_project_keys: () => {
      router.push({
        pathname: `/settings/${params.orgId}/projects/${params.projectId}/keys/`,
      });
    },
  };
}

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
