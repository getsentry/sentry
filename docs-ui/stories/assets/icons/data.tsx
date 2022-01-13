type IconGroupName =
  | 'action'
  | 'navigation'
  | 'content'
  | 'file'
  | 'issue'
  | 'chart'
  | 'layout'
  | 'media'
  | 'device'
  | 'other'
  | 'logo';

export type IconPropName = 'size' | 'direction' | 'isCircled' | 'isSolid' | 'type';

type IconProps = {
  [key in IconPropName]: {
    type: 'boolean' | 'select';
    options?: [string, string][];
    default?: string;
    /**
     * Whether to list all variants of this prop in the icon list
     */
    enumerate?: boolean;
  };
};

type IconGroup = {
  id: IconGroupName;
  label: string;
};

export type IconData = {
  id: string;
  /**
   * List of alternative keywords for better icon search, e.g. the
   * icon 'checkmark' could have a ['done', 'success'] keyword list
   */
  keywords: string[];
  /**
   * Groups that the icon belongs to
   */
  groups: IconGroupName[];
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
    id: 'action',
    label: 'Action',
  },
  {
    id: 'navigation',
    label: 'Navigation',
  },
  {
    id: 'content',
    label: 'Content',
  },
  {
    id: 'layout',
    label: 'Layout',
  },
  {
    id: 'issue',
    label: 'Issue',
  },
  {
    id: 'file',
    label: 'File',
  },
  {
    id: 'media',
    label: 'Media',
  },
  {
    id: 'chart',
    label: 'Chart',
  },
  {
    id: 'device',
    label: 'Device',
  },
  {
    id: 'other',
    label: 'Other',
  },
  {
    id: 'logo',
    label: 'Logo',
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
    groups: ['action', 'navigation'],
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
  {id: 'upload', groups: ['action', 'file'], keywords: ['file', 'image', 'up']},
  {id: 'download', groups: ['action', 'file'], keywords: ['file', 'image', 'down']},
  {id: 'sync', groups: ['action', 'file'], keywords: ['swap']},
  {id: 'menu', groups: ['layout'], keywords: ['navigate']},
  {id: 'list', groups: ['layout'], keywords: ['item']},
  {id: 'activity', groups: ['layout', 'issue'], keywords: ['list']},
  {id: 'dashboard', groups: ['layout'], keywords: ['overview', 'group', 'organize']},
  {id: 'projects', groups: ['content', 'layout'], keywords: ['overview']},
  {
    id: 'upgrade',
    groups: ['action', 'file'],
    keywords: ['up'],
  },
  {
    id: 'open',
    groups: ['action', 'file'],
    keywords: ['link', 'hyperlink', 'external'],
  },
  {
    id: 'return',
    groups: ['action'],
    keywords: ['enter'],
  },
  {
    id: 'refresh',
    groups: ['action', 'navigation'],
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
    groups: ['media'],
    keywords: ['video', 'audio', 'unpause'],
  },
  {
    id: 'pause',
    groups: ['media'],
    keywords: ['video', 'audio', 'stop'],
  },
  {
    id: 'previous',
    groups: ['media'],
    keywords: ['video', 'audio', 'back', 'return', 'rewind'],
  },
  {
    id: 'next',
    groups: ['media'],
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
    groups: ['chart'],
    keywords: ['bar', 'graph'],
  },
  {
    id: 'file',
    groups: ['file', 'content'],
    keywords: ['document'],
  },
  {
    id: 'search',
    groups: ['action'],
    keywords: ['find', 'look', 'query'],
  },
  {
    id: 'copy',
    groups: ['action', 'file', 'content'],
    keywords: ['duplicate'],
  },
  {
    id: 'delete',
    groups: ['action', 'content'],
    keywords: ['trash', 'can', 'dumpster', 'remove', 'erase', 'clear'],
  },
  {
    id: 'docs',
    groups: ['file'],
    keywords: ['document'],
  },
  {
    id: 'print',
    groups: ['action', 'file'],
    keywords: [],
  },
  {
    id: 'project',
    groups: ['issue'],
    keywords: [],
  },
  {
    id: 'code',
    groups: ['content'],
    keywords: ['snippet'],
  },
  {
    id: 'markdown',
    groups: ['content'],
    keywords: ['code'],
  },
  {
    id: 'terminal',
    groups: ['device', 'content'],
    keywords: ['code', 'bash', 'command'],
  },
  {
    id: 'commit',
    groups: ['content'],
    keywords: ['git', 'github'],
  },
  {
    id: 'issues',
    groups: ['content', 'issue'],
    keywords: ['stack'],
  },
  {
    id: 'releases',
    groups: ['content', 'issue'],
    keywords: ['stack', 'versions'],
  },
  {
    id: 'stack',
    groups: ['layout', 'content'],
    keywords: ['group', 'combine', 'view'],
  },
  {
    id: 'span',
    groups: ['content'],
    keywords: ['performance', 'transaction'],
  },
  {
    id: 'link',
    groups: ['action', 'content'],
    keywords: ['hyperlink', 'anchor'],
  },
  {
    id: 'attachment',
    groups: ['action', 'content'],
    keywords: ['include', 'clip'],
  },
  {
    id: 'location',
    groups: ['content'],
    keywords: ['pin', 'position', 'map'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'edit',
    groups: ['action', 'content'],
    keywords: ['pencil'],
  },
  {
    id: 'filter',
    groups: ['action', 'content'],
    keywords: [],
  },
  {
    id: 'show',
    groups: ['action', 'content'],
    keywords: ['visible'],
  },
  {
    id: 'lock',
    groups: ['action'],
    keywords: ['secure'],
  },
  {
    id: 'grabbable',
    groups: ['action', 'layout'],
    keywords: ['move', 'arrange', 'organize', 'rank', 'switch'],
  },
  {
    id: 'ellipsis',
    groups: ['action', 'layout'],
    keywords: ['expand', 'open', 'more', 'hidden'],
  },
  {
    id: 'fire',
    groups: ['issue'],
    keywords: ['danger', 'severe', 'critical'],
  },
  {
    id: 'megaphone',
    groups: ['other'],
    keywords: ['speaker', 'announce'],
  },
  {
    id: 'question',
    groups: ['layout'],
    keywords: ['info', 'about', 'information', 'ask', 'faq', 'q&a'],
  },
  {
    id: 'info',
    groups: ['layout'],
    keywords: ['more', 'about', 'information', 'ask', 'faq', 'q&a'],
  },
  {
    id: 'warning',
    groups: ['issue'],
    keywords: ['alert', 'notification'],
  },
  {
    id: 'not',
    groups: ['other'],
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
    groups: ['content'],
    keywords: ['person', 'portrait'],
  },
  {
    id: 'group',
    groups: ['content'],
    keywords: ['person', 'people'],
  },
  {
    id: 'chat',
    groups: ['action', 'content'],
    keywords: ['message', 'bubble'],
  },
  {
    id: 'support',
    groups: ['content'],
    keywords: ['microphone', 'help'],
  },
  {
    id: 'clock',
    groups: ['content'],
    keywords: ['time', 'watch'],
  },
  {
    id: 'calendar',
    groups: ['content'],
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
    groups: ['content'],
    keywords: ['preference'],
  },
  {
    id: 'mail',
    groups: ['content'],
    keywords: ['email'],
  },
  {
    id: 'fix',
    groups: ['action'],
    keywords: ['wrench', 'resolve'],
  },
  {
    id: 'lab',
    groups: ['content', 'other'],
    keywords: ['experiment', 'test'],
  },
  {
    id: 'tag',
    groups: ['content'],
    keywords: ['price', 'category', 'group'],
  },
  {
    id: 'broadcast',
    groups: ['action', 'content'],
    keywords: ['stream'],
  },
  {
    id: 'telescope',
    groups: ['other'],
    keywords: [],
  },
  {
    id: 'moon',
    groups: ['action'],
    keywords: ['dark', 'night'],
  },
  {
    id: 'lightning',
    groups: ['content'],
    keywords: ['feature', 'new', 'fresh'],
    additionalProps: ['isSolid'],
  },
  {
    id: 'business',
    groups: ['content'],
    keywords: ['feature', 'promotion', 'fresh', 'new'],
  },
  {
    id: 'bell',
    groups: ['content'],
    keywords: ['alert', 'notification', 'ring'],
  },
  {
    id: 'siren',
    groups: ['content'],
    keywords: ['alert', 'important', 'warning'],
  },
  {
    id: 'anchor',
    groups: ['other'],
    keywords: [],
  },
  {
    id: 'circle',
    groups: ['other'],
    keywords: ['shape', 'round'],
  },
  {
    id: 'rectangle',
    groups: ['other'],
    keywords: ['shape', 'rect', 'diamond'],
  },
  {
    id: 'flag',
    groups: ['action'],
    keywords: ['bookmark', 'mark', 'save', 'warning', 'message'],
  },
  {
    id: 'sound',
    groups: ['content', 'action'],
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
];
