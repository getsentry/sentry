export interface RouteWithName {
  name?: string;
  path?: string;
}

export type SettingsBreadcrumbProps = {
  isLast: boolean;
  routeIndex: number;
};
