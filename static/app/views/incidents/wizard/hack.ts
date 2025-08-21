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
