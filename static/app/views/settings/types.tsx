import {ReactElement} from 'react';

import {Organization, Project, Scope} from 'sentry/types';

export type NavigationProps = {
  access?: Set<Scope>;
  features?: Set<string>;
  id?: string;
  isSelfHosted?: boolean;
  organization?: Organization;
  project?: Project;
};

export type NavigationGroupProps = NavigationProps & NavigationSection;

export type NavigationItem = {
  /**
   * The path of the navigation link
   */
  path: string;
  /**
   * The title of the link. This is what will be rendered in the navigation
   * panel.
   */
  title: string;
  /**
   * Returns the text of the badge to render next to the navigation.
   */
  badge?: (opts: NavigationGroupProps) => string | number | null | ReactElement;
  /**
   * The description of the settings section. This will be used in search.
   */
  description?: string;
  /**
   * A string identifier for the navigation item. May be used in hooks to
   * augment navigation items.
   */
  id?: string;
  /**
   * Is this the index settings page for this navigation config.
   */
  index?: boolean;
  /**
   * Should clicking on the sidebar generate an analytics event
   */
  recordAnalytics?: boolean;
  /**
   * Should the navigation item be displayed?
   */
  show?: boolean | ((opts: NavigationGroupProps) => boolean);
};

export type NavigationSection = {
  items: NavigationItem[];
  /**
   * Heading of the navigation section
   */
  name: string;
};
