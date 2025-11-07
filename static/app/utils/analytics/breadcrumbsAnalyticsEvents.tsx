export type BreadcrumbsAnalyticsEventParameters = {
  'breadcrumbs.link.clicked': {organization: null};
  'breadcrumbs.menu.clicked': {organization: null};
};

export const breadcrumbsAnalyticsEventMap: Record<
  keyof BreadcrumbsAnalyticsEventParameters,
  string | null
> = {
  'breadcrumbs.link.clicked': 'Breadcrumbs: Link Clicked',
  'breadcrumbs.menu.clicked': 'Breadcrumbs: Menu Clicked',
};
