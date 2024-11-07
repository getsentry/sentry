export type QuickStartEventParameters = {
  'quick_start.completed': {
    new_experience: boolean;
    referrer: string;
  };
  'quick_start.opened': {
    new_experience: boolean;
  };
  'quick_start.task_card_clicked': {
    action: string;
    new_experience: boolean;
    todo_id: string;
    todo_title: string;
  };
  'quick_start.task_group_completed': {
    group: 'getting_started' | 'beyond_basics';
  };
};

export const quickStartEventMap: Record<keyof QuickStartEventParameters, string> = {
  'quick_start.opened': 'Quick Start: Opened',
  'quick_start.task_card_clicked': 'Quick Start: Task Card Clicked',
  'quick_start.completed': 'Quick Start: Completed',
  'quick_start.task_group_completed': 'Quick Start: Task Group Completed',
};
