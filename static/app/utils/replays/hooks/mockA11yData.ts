export function A11yData(startTimestampMs: number) {
  return [
    {
      elements: [
        {
          alternatives: [
            {
              id: 'button-has-visible-text',
              message:
                'Element does not have inner text that is visible to screen readers',
            },
            {
              id: 'aria-label',
              message: 'aria-label attribute does not exist or is empty',
            },
            {
              id: 'aria-labelledby',
              message:
                'aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty',
            },
            {
              id: 'non-empty-title',
              message: 'Element has no title attribute',
            },
            {
              id: 'presentational-role',
              message:
                'Element\'s default semantics were not overridden with role="none" or role="presentation"',
            },
          ],
          element: '<button class="svelte-19ke1iv">',
          target: ['button:nth-child(1)'],
        },
      ],
      help_url:
        'https://dequeuniversity.com/rules/axe/4.8/button-name?application=playwright',
      help: 'Buttons must have discernible text',
      id: 'button-name',
      impact: 'critical' as const,
      timestamp: startTimestampMs + 1000,
    },
    {
      elements: [
        {
          alternatives: [
            {
              id: 'button-has-visible-text',
              message:
                'Element does not have inner text that is visible to screen readers',
            },
            {
              id: 'aria-label',
              message: 'aria-label attribute does not exist or is empty',
            },
            {
              id: 'aria-labelledby',
              message:
                'aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty',
            },
            {
              id: 'non-empty-title',
              message: 'Element has no title attribute',
            },
            {
              id: 'presentational-role',
              message:
                'Element\'s default semantics were not overridden with role="none" or role="presentation"',
            },
          ],
          element: '<button class="svelte-19ke1iv">',
          target: ['button:nth-child(1)'],
        },
      ],
      help_url:
        'https://dequeuniversity.com/rules/axe/4.8/button-name?application=playwright',
      help: 'Buttons must have discernible text',
      id: 'button-name',
      impact: 'serious' as const,
      timestamp: startTimestampMs + 2000,
    },
    {
      elements: [
        {
          alternatives: [
            {
              id: 'button-has-visible-text',
              message:
                'Element does not have inner text that is visible to screen readers',
            },
            {
              id: 'aria-label',
              message: 'aria-label attribute does not exist or is empty',
            },
            {
              id: 'aria-labelledby',
              message:
                'aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty',
            },
            {
              id: 'non-empty-title',
              message: 'Element has no title attribute',
            },
            {
              id: 'presentational-role',
              message:
                'Element\'s default semantics were not overridden with role="none" or role="presentation"',
            },
          ],
          element: '<button class="svelte-19ke1iv">',
          target: ['button:nth-child(1)'],
        },
      ],
      help_url:
        'https://dequeuniversity.com/rules/axe/4.8/button-name?application=playwright',
      help: 'Buttons must have discernible text',
      id: 'button-name',
      impact: 'moderate' as const,
      timestamp: startTimestampMs + 3000,
    },
  ];
}
