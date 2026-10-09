import {t} from 'sentry/locale';
import type {ChatSuggestion} from 'sentry/views/seerExplorer/types';

/** The empty state's suggestions before generated ones existed. */
export const LEGACY_SUGGESTIONS: ChatSuggestion[] = [
  {text: t('Which of my open issues are getting worse, not better?')},
  {text: t('What are my slowest DB queries?')},
  {text: t("Walk me through what's on my screen and what I can focus on next.")},
];

/** Fixed suggestions shown when generation times out, fails, or returns nothing. */
export function getFallbackSuggestions(
  route: string,
  hasDbData: boolean
): ChatSuggestion[] {
  if (route.startsWith('/issues/:groupId/')) {
    return [
      {text: t("What's the likely root cause of this issue?")},
      {text: t('When did this start, and what changed around then?')},
      {text: t('Who is the best person to look at this issue?')},
    ];
  }
  return [
    {text: t("Walk me through what's on my screen and what I can focus on next.")},
    {text: t('Which of my open issues are getting worse, not better?')},
    ...(hasDbData ? [{text: t('What are my slowest DB queries?')}] : []),
  ];
}
