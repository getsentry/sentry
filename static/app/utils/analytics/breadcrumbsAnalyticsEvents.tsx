export type BreadcrumbsAnalyticsEventParameters = {
  'breadcrumbs.link.clicked': {organization: null};
  'breadcrumbs.menu.clicked': {organization: null};
};

export type BreadcrumbsAnalyticsKey = keyof BreadcrumbsAnalyticsEventParameters;

export const breadcrumbsAnalyticsEventMap: Record<
  BreadcrumbsAnalyticsKey,
  string | null
> = {
  'breadcrumbs.link.clicked': 'Breadcrumbs: Link Clicked',
  'breadcrumbs.menu.clicked': 'Breadcrumbs: Menu Clicked',
};
