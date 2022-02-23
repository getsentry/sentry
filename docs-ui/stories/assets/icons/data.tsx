type IconGroupName =
  | 'product'
  | 'action'
  | 'navigation'
  | 'status'
  | 'chart'
  | 'device'
  | 'logo';

export type IconPropName = 'size' | 'direction' | 'isCircled' | 'isSolid' | 'type';

type IconProps = {
  [key in IconPropName]: {
    type: 'boolean' | 'select';
    default?: string;
    /**
     * Whether to list all variants of this prop in the icon list
     */
    enumerate?: boolean;
    options?: [string, string][];
  };
};

type IconGroup = {
  id: IconGroupName;
  label: string;
};

export type IconData = {
  /**
   * Groups that the icon belongs to
   */
  groups: IconGroupName[];
  id: string;
  /**
   * List of alternative keywords for better icon search, e.g. the
   * icon 'checkmark' could have a ['done', 'success'] keyword list
   */
  keywords: string[];
  /**
   * Any additional props besides 'size' and 'color'. This includes
   * props like 'isCircled' and 'direction'.
   */
  additionalProps?: IconPropName[];
  /**
   * Limit the set of options available for certain additional props.
   * For example, {direction: ['left', 'up']} would limit the available
   * options for the prop 'direction' to just 'left' and 'up'. Useful for
   * controlling prop enumeration in the icon list.
   */
  limitOptions?: Partial<Record<IconPropName, string[][]>>;
};

export const iconProps: IconProps = {
  size: {
    type: 'select',
    options: [
      ['xs', 'Extra small'],
      ['sm', 'Small'],
      ['md', 'Medium'],
      ['lg', 'Large'],
      ['xl', 'Extra large'],
    ],
    default: 'sm',
  },
  type: {
    type: 'select',
    options: [
      ['line', 'Line'],
      ['circle', 'Circle'],
      ['bar', 'Bar'],
    ],
    default: 'line',
    enumerate: true,
  },
  direction: {
    type: 'select',
    options: [
      ['left', 'Left'],
      ['right', 'Right'],
      ['up', 'Up'],
      ['down', 'Down'],
    ],
    default: 'left',
    enumerate: true,
  },
  isCircled: {type: 'boolean', enumerate: true},
  isSolid: {type: 'boolean', enumerate: true},
};

export const iconGroups: IconGroup[] = [
  {
    id: 'product',
    label: 'Product',
  },
  {
    id: 'logo',
    label: 'Logos',
  },
  {
    id: 'navigation',
    label: 'Navigation',
  },
  {
    id: 'status',
    label: 'Status',
  },
  {
    id: 'action',
    label: 'Action',
  },
  {
    id: 'chart',
    label: 'Chart',
  },
  {
    id: 'device',
    label: 'Device',
  },
];

export const icons: IconData[] = [
  {id: 'add', groups: ['action'], keywords: ['plus'], additionalProps: ['isCircled']},
  {
    id: 'subtract',
    groups: ['action'],
    keywords: ['minus'],
    additionalProps: ['isCircled'],
  },
  {
    id: 'checkmark',
    groups: ['action'],
    keywords: ['done', 'finish', 'success', 'confirm', 'resolve'],
    additionalProps: ['isCircled'],
  },
  {
    id: 'close',
    groups: ['action'],
    keywords: ['cross', 'deny', 'terminate'],
    additionalProps: ['isCircled'],
  },
  {
    id: 'chevron',
    groups: ['navigation'],
    keywords: [
      'up',
      'down',
      'left',
      'right',
      'point',
      'direct',
      'move',
      'expand',
      'collapse',
      'arrow',
    ],
    additionalProps: ['isCircled', 'direction'],
  },
  {
    id: 'arrow',
    groups: ['navigation'],
    keywords: ['up', 'down', 'left', 'right', 'point', 'direct', 'move'],
    additionalProps: ['direction'],
  },
  {id: 'upload', groups: ['action'], keywords: ['file', 'image', 'up']},
  {id: 'download', groups: ['action'], keywords: ['file', 'image', 'down']},
  {id: 'sync', groups: ['action'], keywords: ['swap']},
  {id: 'menu', groups: ['action'], keywords: ['navigate']},
  {id: 'list', groups: ['action'], keywords: ['item']},
  {id: 'dashboard', groups: ['action'], keywords: ['overview', 'group', 'organize']},
  {
    id: 'upgrade',
    groups: ['action'],
    keywords: ['up'],
  },
  {
    id: 'open',
    groups: ['action'],
    keywords: ['link', 'hyperlink', 'external'],
  },
  {
    id: 'return',
    groups: ['action'],
    keywords: ['enter'],
  },
  {
    id: 'refresh',
    groups: ['action'],
    keywords: ['reload', 'restart'],
  },
  {
    id: 'bookmark',
    groups: ['action'],
    keywords: ['favorite', 'star', 'mark'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'pin',
    groups: ['action'],
    keywords: ['stick'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'star',
    groups: ['action'],
    keywords: ['favorite', 'star', 'bookmark'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'play',
    groups: ['action'],
    keywords: ['video', 'audio', 'unpause'],
  },
  {
    id: 'pause',
    groups: ['action'],
    keywords: ['video', 'audio', 'stop'],
  },
  {
    id: 'previous',
    groups: ['action'],
    keywords: ['video', 'audio', 'back', 'return', 'rewind'],
  },
  {
    id: 'next',
    groups: ['action'],
    keywords: ['video', 'audio', 'skip', 'forward'],
  },
  {
    id: 'graph',
    groups: ['chart'],
    keywords: ['line', 'plot'],
    additionalProps: ['type'],
  },
  {
    id: 'stats',
    groups: ['product', 'chart'],
    keywords: ['bar', 'graph'],
  },
  {
    id: 'file',
    groups: ['device'],
    keywords: ['document'],
  },
  {
    id: 'search',
    groups: ['action'],
    keywords: ['find', 'look', 'query'],
  },
  {
    id: 'copy',
    groups: ['action'],
    keywords: ['duplicate'],
  },
  {
    id: 'delete',
    groups: ['action'],
    keywords: ['trash', 'can', 'dumpster', 'remove', 'erase', 'clear'],
  },
  {
    id: 'docs',
    groups: ['action'],
    keywords: ['document'],
  },
  {
    id: 'print',
    groups: ['action', 'device'],
    keywords: [],
  },
  {
    id: 'project',
    groups: ['product'],
    keywords: [],
  },
  {
    id: 'code',
    groups: ['device'],
    keywords: ['snippet'],
  },
  {
    id: 'markdown',
    groups: ['device'],
    keywords: ['code'],
  },
  {
    id: 'terminal',
    groups: ['device', 'device'],
    keywords: ['code', 'bash', 'command'],
  },
  {
    id: 'commit',
    groups: ['device'],
    keywords: ['git', 'github'],
  },
  {
    id: 'issues',
    groups: ['product'],
    keywords: ['stack'],
  },
  {
    id: 'releases',
    groups: ['product'],
    keywords: ['stack', 'versions'],
  },
  {
    id: 'stack',
    groups: ['action'],
    keywords: ['group', 'combine', 'view'],
  },
  {
    id: 'span',
    groups: ['device'],
    keywords: ['performance', 'transaction'],
  },
  {
    id: 'link',
    groups: ['action', 'device'],
    keywords: ['hyperlink', 'anchor'],
  },
  {
    id: 'attachment',
    groups: ['device'],
    keywords: ['include', 'clip'],
  },
  {
    id: 'location',
    groups: ['action'],
    keywords: ['pin', 'position', 'map'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'edit',
    groups: ['action'],
    keywords: ['pencil'],
  },
  {
    id: 'filter',
    groups: ['action'],
    keywords: [],
  },
  {
    id: 'show',
    groups: ['action'],
    keywords: ['visible'],
  },
  {
    id: 'lock',
    groups: ['action'],
    keywords: ['secure'],
  },
  {
    id: 'grabbable',
    groups: ['action'],
    keywords: ['move', 'arrange', 'organize', 'rank', 'switch'],
  },
  {
    id: 'ellipsis',
    groups: ['action'],
    keywords: ['expand', 'open', 'more', 'hidden'],
  },
  {
    id: 'fire',
    groups: ['status'],
    keywords: ['danger', 'severe', 'critical'],
  },
  {
    id: 'megaphone',
    groups: ['action'],
    keywords: ['speaker', 'announce'],
  },
  {
    id: 'fatal',
    groups: ['status'],
    keywords: ['skull'],
  },
  {
    id: 'question',
    groups: ['action'],
    keywords: ['info', 'about', 'information', 'ask', 'faq', 'q&a'],
  },
  {
    id: 'info',
    groups: ['action'],
    keywords: ['more', 'about', 'information', 'ask', 'faq', 'q&a'],
  },
  {
    id: 'warning',
    groups: ['status'],
    keywords: ['alert', 'notification'],
  },
  {
    id: 'exclamation',
    groups: ['status'],
    keywords: ['alert', 'warning'],
  },
  {
    id: 'not',
    groups: ['status'],
    keywords: ['invalid', 'no', 'forbidden'],
  },
  {
    id: 'laptop',
    groups: ['device'],
    keywords: ['computer', 'macbook'],
  },
  {
    id: 'mobile',
    groups: ['device'],
    keywords: ['phone', 'iphone'],
  },
  {
    id: 'window',
    groups: ['device'],
    keywords: ['application'],
  },
  {
    id: 'user',
    groups: ['action'],
    keywords: ['person', 'portrait'],
  },
  {
    id: 'group',
    groups: ['action'],
    keywords: ['person', 'people'],
  },
  {
    id: 'chat',
    groups: ['action', 'action'],
    keywords: ['message', 'bubble'],
  },
  {
    id: 'support',
    groups: ['product'],
    keywords: ['microphone', 'help'],
  },
  {
    id: 'clock',
    groups: ['action'],
    keywords: ['time', 'watch'],
  },
  {
    id: 'calendar',
    groups: ['device'],
    keywords: ['time', 'date'],
  },
  {
    id: 'sliders',
    groups: ['action'],
    keywords: ['settings', 'slide', 'adjust'],
    additionalProps: ['direction'],
    limitOptions: {
      direction: [
        ['left', 'Left'],
        ['up', 'Up'],
      ],
    },
  },
  {id: 'switch', groups: ['action'], keywords: ['swap']},
  {
    id: 'toggle',
    groups: ['action'],
    keywords: ['switch', 'form', 'disable', 'enable'],
  },
  {
    id: 'settings',
    groups: ['product'],
    keywords: ['preference'],
  },
  {
    id: 'mail',
    groups: ['device'],
    keywords: ['email'],
  },
  {
    id: 'fix',
    groups: ['action'],
    keywords: ['wrench', 'resolve'],
  },
  {
    id: 'lab',
    groups: ['product'],
    keywords: ['experiment', 'test'],
  },
  {
    id: 'tag',
    groups: ['action'],
    keywords: ['price', 'category', 'group'],
  },
  {
    id: 'broadcast',
    groups: ['product'],
    keywords: ['stream'],
  },
  {
    id: 'telescope',
    groups: ['product'],
    keywords: [],
  },
  {
    id: 'moon',
    groups: ['action'],
    keywords: ['dark', 'night'],
  },
  {
    id: 'lightning',
    groups: ['product'],
    keywords: ['feature', 'new', 'fresh'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'business',
    groups: ['product'],
    keywords: ['feature', 'promotion', 'fresh', 'new'],
  },
  {
    id: 'bell',
    groups: ['action'],
    keywords: ['alert', 'notification', 'ring'],
  },
  {
    id: 'siren',
    groups: ['product'],
    keywords: ['alert', 'important', 'warning'],
  },
  {
    id: 'anchor',
    groups: ['action'],
    keywords: [],
  },
  {
    id: 'circle',
    groups: ['status'],
    keywords: ['shape', 'round'],
  },
  {
    id: 'diamond',
    groups: ['status'],
    keywords: ['shape', 'alert', 'diamond'],
  },
  {
    id: 'flag',
    groups: ['status'],
    keywords: ['bookmark', 'mark', 'save', 'warning', 'message'],
  },
  {
    id: 'sound',
    groups: ['action'],
    keywords: ['audio'],
  },
  {
    id: 'mute',
    groups: ['action'],
    keywords: ['audio'],
  },
  {
    id: 'sentry',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'bitbucket',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'github',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'gitlab',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'google',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'jira',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'trello',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'vsts',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'generic',
    groups: ['logo'],
    keywords: [],
  },
  {
    id: 'resize',
    groups: ['action'],
    keywords: ['scale', 'stretch'],
  },
  {
    id: 'happy',
    groups: ['status'],
    keywords: ['good'],
  },
  {
    id: 'meh',
    groups: ['status'],
    keywords: ['meh'],
  },
  {
    id: 'sad',
    groups: ['status'],
    keywords: ['poor'],
  },
  {
    id: 'expand',
    groups: ['action'],
    keywords: ['open'],
  },
];
