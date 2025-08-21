import {
  IconCheckmark,
  IconChevron,
  IconClock,
  IconFire,
  IconFix,
  IconUser,
} from 'sentry/icons';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';

export const INTEGRATION_CRIMES = {
  jira: [
    {
      id: '10001',
      code: 'LR2',
      name: 'Leander 2',
    },
    {
      id: '10002',
      code: 'LR3',
      name: 'Leander 3',
    },
    {
      id: '10004',
      code: 'LBP',
      name: 'Leander Bitbucket Project',
    },
    {
      id: '10006',
      code: 'INC',
      name: 'Incident Management',
    },
  ],
  notion: [
    {
      id: '254eac1b39ad80b6886feb6ae76556ec',
      title: {
        plain_text: 'Incident Retrospectives',
      },
      icon: {
        external: {
          url: 'https://www.notion.so/icons/graduate_yellow.svg',
        },
      },
      url: 'https://www.notion.so/254eac1b39ad80b6886feb6ae76556ec',
    },
  ],

  statuspage: [
    {
      id: '5pt6vxc1jn45',
      headline: 'Parks Canada Agency',
      url: 'https://hw2025.statuspage.io/',
      favicon_logo: {
        url: 'https://dka575ofm4ao0.cloudfront.net/pages-favicon_logos/original/929868/pc-beaver-green-b41c6f82-f8d4-4fe0-9b5c-3e84db4e0945.png',
      },
    },
  ],
} as const;

export const TOOL_STEP_EMPTY_STATE = {
  schedule: null,
  task: null,
  channel: null,
  status_page: null,
  retro: null,
} as const;

export const TEMP_TOOL_STEP_STATE = {
  schedule: {
    integrationKey: 'pagerduty',
    service: {label: 'Firefighters', value: 'b135cdb80378400cd05fcf845aeca092'},
    integrationId: '2',
  },
  task: {
    integrationKey: 'jira',
    project: {id: '10004', code: 'INC', name: 'Incident Management'},
    integrationId: '6',
  },
  channel: {
    integrationKey: 'slack',
    integrationId: '1',
  },
  status_page: {
    integrationKey: 'statuspage',
    statuspage: {
      id: '5pt6vxc1jn45',
      headline: 'Parks Canada Agency',
      url: 'https://hw2025.statuspage.io/',
      favicon_logo: {
        url: '//dka575ofm4ao0.cloudfront.net/pages-favicon_logos/original/929868/pc-beaver-green-b41c6f82-f8d4-4fe0-9b5c-3e84db4e0945.png',
      },
    },
    integrationId: '4',
  },
  retro: {
    integrationKey: 'notion',
    database: {
      id: '254eac1b39ad80b6886feb6ae76556ec',
      title: {plain_text: 'Incident Retrospectives'},
      icon: {external: {url: 'https://www.notion.so/icons/graduate_yellow.svg'}},
      url: 'https://www.notion.so/254eac1b39ad80b6886feb6ae76556ec',
    },
    integrationId: '3',
  },
};

export const FULL_CTX = {
  tools: {
    complete: true,
    schedule_provider: 'pagerduty',
    schedule_config: {
      integrationKey: 'pagerduty',
      service: {label: 'Firefighters', value: 'b135cdb80378400cd05fcf845aeca092'},
      integrationId: '2',
    },
    task_provider: 'jira',
    task_config: {
      integrationKey: 'jira',
      project: {
        id: '10004',
        code: 'LBP',
        name: 'Leander Bitbucket Project',
      },
      integrationId: '6',
    },
    channel_provider: 'slack',
    channel_config: {
      integrationKey: 'slack',
      integrationId: '1',
    },
    status_page_provider: 'statuspage',
    status_page_config: {
      integrationKey: 'statuspage',
      statuspage: {
        id: '5pt6vxc1jn45',
        headline: 'Parks Canada Agency',
        url: 'https://hw2025.statuspage.io/',
        favicon_logo: {
          url: 'https://dka575ofm4ao0.cloudfront.net/pages-favicon_logos/original/929868/pc-beaver-green-b41c6f82-f8d4-4fe0-9b5c-3e84db4e0945.png',
        },
      },
      integrationId: '4',
    },
    retro_provider: 'notion',
    retro_config: {
      integrationKey: 'notion',
      database: {
        id: '254eac1b39ad80b6886feb6ae76556ec',
        title: {
          plain_text: 'Incident Retrospectives',
        },
        icon: {
          external: {
            url: 'https://www.notion.so/icons/graduate_yellow.svg',
          },
        },
        url: 'https://www.notion.so/254eac1b39ad80b6886feb6ae76556ec',
      },
      integrationId: '3',
    },
  },
  demo: {
    complete: false,
  },
  components: {
    complete: true,
  },
  smokey: {
    complete: true,
  },
  template: {
    complete: true,
    case_handle: 'INC',
    severity_handle: 'SEV',
    lead_title: 'Captain',
    update_frequency: '15',
  },
};

export const CONVERSATION_DATA = [
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    message:
      '🚨 Declared an incident. Getting a ton of 500s on the site, anyone else seeing this?',
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 29),
    message: "Yeah, I'm seeing errors too. Looks like the API is timing out.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 28),
    message: "I'll check the logs. Not sure if it's infra or a deploy gone wrong.",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 27),
    message: "I'm seeing a spike in DB connections. Could be a pool exhaustion.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 26),
    message: "Confirmed, DB pool is maxed out. I'll kill some long-running queries.",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
    message: "Thanks! I'll update the status page and let support know.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 24),
    message: "Temporary fix in place. Errors are dropping. Let's keep an eye on it.",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 23),
    message: "Nice work. I'll start a retro doc so we can track the root cause.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 22),
    message: "Found it! Recent deploy missed a connection cleanup. I'll revert.",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 21),
    message:
      "Revert looks good. Errors are gone. I'll update the status page to resolved.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 20),
    message: "Awesome teamwork. Let's schedule a post-mortem for tomorrow.",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 19),
    message: 'Agreed! Thanks for jumping on this so fast.',
  },
];

export const MOCK_TIMELINE = [
  {
    title: 'Incident Declared',
    text: 'High severity incident declared by engineering team',
    icon: <IconFire size="sm" />,
    colorConfig: {
      icon: 'red400',
      iconBorder: 'red400',
      title: 'red400',
    },
  },
  {
    title: 'Team Notified',
    text: 'PagerDuty alert sent to on-call engineer',
    icon: <PluginIcon pluginId="pagerduty" />,
    colorConfig: {
      icon: 'green400',
      iconBorder: 'green400',
      title: 'green400',
    },
  },
  {
    title: 'Incident Commander Assigned',
    text: 'Alice Smith assigned as Incident Commander',
    icon: <IconUser size="xs" />,
    colorConfig: {
      icon: 'blue400',
      iconBorder: 'blue400',
      title: 'blue400',
    },
  },
  {
    title: 'Initial Triage',
    text: 'Engineering team begins triage and root cause analysis',
    icon: <IconFix size="xs" />,
    colorConfig: {
      icon: 'purple400',
      iconBorder: 'purple400',
      title: 'purple400',
    },
  },
  {
    title: 'Status Page Updated',
    text: 'Public status page updated to reflect ongoing incident',
    icon: <PluginIcon pluginId="statuspage" />,
    colorConfig: {
      icon: 'blue400',
      iconBorder: 'blue400',
      title: 'blue400',
    },
  },
  // Tasks (Jira) - placed before mitigation
  {
    title: 'Task: Notify Customer Support',
    text: 'Customer support team notified to prepare for incoming tickets.',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Task: Update Incident Documentation',
    text: 'Incident documentation updated in Confluence.',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Task: Monitor System Metrics',
    text: 'Ongoing monitoring of system health metrics.',
    icon: <PluginIcon pluginId="jira" />,
  },
  // Mitigation
  {
    title: 'Mitigation Deployed',
    text: 'Temporary fix deployed to reduce customer impact',
    icon: <IconChevron direction="up" size="xs" />,
    colorConfig: {
      icon: 'yellow400',
      iconBorder: 'yellow400',
      title: 'yellow400',
    },
  },
  // Resolution (Notion)
  {
    title: 'Resolution',
    text: 'Root cause identified and permanent fix applied',
    icon: <IconCheckmark size="xs" />,
    colorConfig: {
      icon: 'pink400',
      iconBorder: 'pink400',
      title: 'pink400',
    },
  },
  {
    title: 'Postmortem Document Created',
    text: 'A document was added to the Incident Retrospectives database',
    icon: <PluginIcon pluginId="notion" />,
  },
  {
    title: 'Postmortem Scheduled',
    text: 'Retrospective meeting scheduled for next week',
    icon: <IconClock size="xs" />,
  },
  // Action Items (Jira)
  {
    title: 'Action Item: Conduct Root Cause Analysis',
    text: 'Schedule and conduct a root cause analysis meeting.',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Action Item: Implement Preventative Measures',
    text: 'Engineering to implement changes to prevent recurrence.',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Action Item: Share Learnings with Team',
    text: 'Share incident learnings and improvements with the broader team.',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Action Item: Close Incident',
    text: 'All follow-up tasks completed, incident officially closed.',
    icon: <PluginIcon pluginId="jira" />,
  },
].map((item, index) => ({
  ...item,
  time: new Date(Date.now() - index * (1 + Math.random() * 9) * 60 * 1000),
}));
