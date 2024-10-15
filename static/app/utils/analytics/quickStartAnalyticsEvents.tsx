export type QuickStartEventParameters = {
  'quick_start.completed': {
    referrer: string;
  };
  'quick_start.opened': {};
  'quick_start.task_card_clicked': {
    action: string;
    todo_id: string;
    todo_title: string;
  };
};

export const quickStartEventMap: Record<keyof QuickStartEventParameters, string> = {
  'quick_start.opened': 'Quick Start: Opened',
  'quick_start.task_card_clicked': 'Quick Start: Task Card Clicked',
  'quick_start.completed': 'Quick Start: Completed',
};
