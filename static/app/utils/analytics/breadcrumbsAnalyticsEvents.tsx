export type BreadcrumbsAnalyticsEventParameters = {
  'breadcrumbs.link.clicked': {organization: null};
  'breadcrumbs.menu.opened': {organization: null};
};

export const breadcrumbsAnalyticsEventMap: Record<
  keyof BreadcrumbsAnalyticsEventParameters,
  string | null
> = {
  'breadcrumbs.link.clicked': 'Breadcrumbs: Link Clicked',
  'breadcrumbs.menu.opened': 'Breadcrumbs: Menu Opened',
};
