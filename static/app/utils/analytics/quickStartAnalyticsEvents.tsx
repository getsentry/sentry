export type QuickStartEventParameters = {
  'quick_start.completed': {
    referrer: string;
  };
  'quick_start.opened': {
    source:
      | 'targeted_onboarding_welcome_skip'
      | 'targeted_onboarding_select_platform_skip'
      | 'targeted_onboarding_first_event_footer_skip'
      | 'onboarding_sidebar'
      | 'onboarding_sidebar_user_second_visit';
    user_clicked: boolean;
  };
  'quick_start.task_card_clicked': {
    action: string;
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
