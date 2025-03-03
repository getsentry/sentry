export type NavigationEventParameters = {
  'navigation.help_menu_opt_in_stacked_navigation_clicked': Record<string, unknown>;
  'navigation.help_menu_opt_out_stacked_navigation_clicked': Record<string, unknown>;
};

export type NavigationEventKey = keyof NavigationEventParameters;

export const navigationAnalyticsEventMap: Record<NavigationEventKey, string | null> = {
  'navigation.help_menu_opt_in_stacked_navigation_clicked':
    'Navigation: Help Menu Opt In To Stacked Navigation Clicked',
  'navigation.help_menu_opt_out_stacked_navigation_clicked':
    'Navigation: Help Menu Opt Out Of Stacked Navigation Clicked',
};
