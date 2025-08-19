import {useCallback, useEffect, useState} from 'react';

import {IconDocs} from 'sentry/icons';

import type {OmniAction} from './types';

type LLMRoutingResult = {
  route: 'traces' | 'issues' | 'other';
};

export function useLLMRoutingDynamicActions(query: string): OmniAction[] {
  const [extraRouteActions, setExtraRouteActions] = useState<OmniAction[]>([]);
  const attemptRouteQuery = useCallback(async () => {
    if (!query) {
      return;
    }

    const url =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:5000/route-query'
        : 'https://cmdkllm-12459da2e71a.herokuapp.com/route-query';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    });
    const data: LLMRoutingResult = await res.json();

    const route = data.route;

    if (route === 'other') {
      setExtraRouteActions([]);
    } else if (route === 'traces') {
      setExtraRouteActions([
        {
          key: 'nl-trace-query',
          areaKey: 'navigate',
          label: 'Find this in trace explorer',
          actionIcon: <IconDocs />,
          onAction: () => {
            // console.log('trace explorer');
          },
        },
      ]);
    } else if (route === 'issues') {
      setExtraRouteActions([
        {
          key: 'nl-issue-query',
          areaKey: 'navigate',
          label: 'Find this in issue details',
          actionIcon: <IconDocs />,
          onAction: () => {
            // console.log('issue details');
          },
        },
      ]);
    }
  }, [query]);

  useEffect(() => {
    attemptRouteQuery();
  }, [attemptRouteQuery]);

  return extraRouteActions;
}
