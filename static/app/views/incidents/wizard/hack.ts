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
        url: '//dka575ofm4ao0.cloudfront.net/pages-favicon_logos/original/929868/pc-beaver-green-b41c6f82-f8d4-4fe0-9b5c-3e84db4e0945.png',
      },
    },
  ],
} as const;
