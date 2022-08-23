export type Workspace = any;

export const workspaces: Workspace[] = [
  {
    id: '1',
    name: 'INC-451: EU West Outage',
    description:
      'This workspace contains all the data associated with the Western European outage on February 30th, 2014. See the named Jira ticket for more details',
    members: [
      {
        type: 'team',
        id: '24',
        name: 'executive',
        slug: 'executive',
      },
    ],
  },
  {
    id: '2',
    name: 'Secret Project #1',
    description:
      'The (Secret) new project developed by the Seattle team to deploy later this quarter. Expect lots of errors as we move fast and break everything.',
    members: [
      {
        type: 'team',
        id: '26',
        name: 'secret-team',
        slug: 'secret-team',
      },
    ],
  },
  {
    id: '3',
    name: 'Ecosystem Triage',
    description:
      'An overview of everything that belong to the Ecosystem team, contact @eco in Slack for details.',
    members: [
      {
        type: 'team',
        id: '23',
        name: 'ecosystem',
        slug: 'ecosystem',
      },
    ],
  },

  {
    id: '4',
    name: "Leander's Stuff",
    description:
      'Ongoing history of all my bug fixes, specific alerts, and other Sentry stuff',
    members: [
      {
        type: 'user',
        id: '1',
        name: 'Leander Rodrigues',
      },
    ],
  },
  {
    id: '5',
    name: 'Q3 SLO Violations',
    description:
      "As discussed in EPD QBR, we're storing data about Exec Team violations in Q3 here.",
    members: [
      {
        type: 'team',
        id: '24',
        name: 'executive',
        slug: 'executive',
      },
    ],
  },
  {
    id: '6',
    name: "Ethan's To-do Pile",
    description: 'TODO: Right a better, searchable description. --Ethan',
    members: [
      {
        type: 'user',
        id: '2',
        name: 'Ethan Hawke',
      },
      {
        type: 'team',
        id: '24',
        name: 'executive',
        slug: 'executive',
      },
    ],
  },
];
