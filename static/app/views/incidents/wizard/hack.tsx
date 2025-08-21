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
    {id: '10001', code: 'CAN', name: 'Canopy'},
    {id: '10002', code: 'EM', name: 'Ember'},
    {id: '10003', code: 'WIL', name: 'Wildfires'},
    {id: '10004', code: 'TRAIL', name: 'Trailmap'},
  ],
  notion: [
    {
      id: '254eac1b39ad80b6886feb6ae76556ec',
      title: {plain_text: 'Park Inc Retros'},
      icon: {external: {url: 'https://www.notion.so/icons/conifer-tree_yellow.svg'}},
      url: 'https://www.notion.so/254eac1b39ad80b6886feb6ae76556ec',
    },
  ],

  statuspage: [
    {
      id: '5pt6vxc1jn45',
      headline: 'Parks Canada',
      url: 'https://hw2025.statuspage.io/',
      favicon_logo: {
        url: 'https://dka575ofm4ao0.cloudfront.net/pages-favicon_logos/original/929868/pc-beaver-green-b41c6f82-f8d4-4fe0-9b5c-3e84db4e0945.png',
      },
    },
  ],
} as const;

export const CONVERSATION_DATA = [
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    message:
      'the river is flowing backwards and the controlled burn system is just... smoking. anyone else seeing this?',
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 29),
    message:
      "yeah i see it but i am literally a bear. i mostly eat fish and nap. i don't know what a controlled burn is.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 28),
    message: "i'll check the logs. maybe it's a beaver thing? or a salmon ddos?",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 27),
    message:
      "i tried to type 'systemctl restart river' but i just mashed my paw on the keyboard and now there are claw marks.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 26),
    message: 'confirmed, the logs are just full of honey. this is not helpful.',
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
    message: "i can offer you a stick? or maybe a rock? that's my whole support toolkit.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 24),
    message:
      'temporary fix: i yelled at the river. it ignored me. errors are still happening.',
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 23),
    message: 'i started a retro doc but i ate it. sorry. paper tastes like tree.',
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 22),
    message:
      'found the issue! someone replaced the burn system with a pile of leaves. classic.',
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 21),
    message:
      "i tried to help but i got distracted by a butterfly. status page now just says 'bear'.",
  },
  {
    name: 'leander',
    timestamp: new Date(Date.now() - 1000 * 60 * 20),
    message:
      "let's schedule a post-mortem. bring snacks. no laptops, only logs (the wooden kind).",
  },
  {
    name: 'madeleine',
    timestamp: new Date(Date.now() - 1000 * 60 * 19),
    message: 'deal. i will bring berries and a strong sense of confusion.',
  },
];

export const MOCK_TIMELINE = [
  {
    title: 'Incident Declared',
    text: 'leander declares incident: river flowing backwards, controlled burn system smoking',
    icon: <IconFire size="sm" />,
    colorConfig: {
      icon: 'red400',
      iconBorder: 'red400',
      title: 'red400',
    },
  },
  {
    title: 'Team Notified',
    text: 'madeleine (bear) acknowledges but mostly eats fish and naps',
    icon: <IconUser size="xs" />,
    colorConfig: {
      icon: 'green400',
      iconBorder: 'green400',
      title: 'green400',
    },
  },
  {
    title: 'Initial Investigation',
    text: 'leander checks logs, finds only honey. madeleine tries systemctl restart river',
    icon: <IconFix size="xs" />,
    colorConfig: {
      icon: 'purple400',
      iconBorder: 'purple400',
      title: 'purple400',
    },
  },
  {
    title: 'Temporary Fix Attempted',
    text: 'leander yells at river, madeleine offers stick and rock as support tools',
    icon: <IconChevron direction="up" size="xs" />,
    colorConfig: {
      icon: 'yellow400',
      iconBorder: 'yellow400',
      title: 'yellow400',
    },
  },
  {
    title: 'Status Page Updated',
    text: 'Status page now just says "bear" after madeleine gets distracted by butterfly',
    icon: <PluginIcon pluginId="statuspage" />,
    colorConfig: {
      icon: 'blue400',
      iconBorder: 'blue400',
      title: 'blue400',
    },
  },
  {
    title: 'Task: Investigate Beaver Activity',
    text: 'Check if beavers are causing river flow issues or salmon DDoS',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Task: Fix Keyboard Damage',
    text: 'Replace keyboard with claw marks from bear paw mashing',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Task: Restore Burn System',
    text: 'Replace pile of leaves with actual controlled burn system',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Root Cause Identified',
    text: 'Someone replaced burn system with pile of leaves. Classic.',
    icon: <IconCheckmark size="xs" />,
    colorConfig: {
      icon: 'pink400',
      iconBorder: 'pink400',
      title: 'pink400',
    },
  },
  {
    title: 'Postmortem Document Created',
    text: 'Retro doc started but madeleine ate it. Paper tastes like tree.',
    icon: <PluginIcon pluginId="notion" />,
  },
  {
    title: 'Postmortem Scheduled',
    text: 'Post-mortem scheduled with snacks. No laptops, only wooden logs. madeleine bringing berries and confusion',
    icon: <IconClock size="xs" />,
  },
  {
    title: 'Action Item: Train Bears on Incident Response',
    text: 'Provide bear-friendly keyboards and incident response training',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Action Item: Secure Burn System',
    text: 'Implement measures to prevent leaves from replacing critical systems',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Action Item: River Flow Monitoring',
    text: 'Set up alerts for when rivers start flowing backwards',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Action Item: Prepare Post-Mortem Snacks',
    text: 'Stock up on berries and wooden logs for the retro meeting',
    icon: <PluginIcon pluginId="jira" />,
  },
  {
    title: 'Incident Resolved',
    text: 'Awesome teamwork between human and bear. Post-mortem scheduled with berry snacks and wooden logs.',
    icon: <IconCheckmark size="xs" />,
    colorConfig: {
      icon: 'green400',
      iconBorder: 'green400',
      title: 'green400',
    },
  },
].map((item, index) => ({
  ...item,
  time: new Date(Date.now() - index * (1 + Math.random() * 9) * 60 * 1000),
}));
