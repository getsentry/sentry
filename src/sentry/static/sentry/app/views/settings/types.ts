import {Organization, Project, Scope} from 'app/types';

export type NavigationProps = {
  id?: string;
  organization?: Organization;
  project?: Project;
  access?: Set<Scope>;
  features?: Set<string>;
};

export type NavigationGroupProps = NavigationProps & NavigationSection;

export type NavigationItem = {
  /**
   * A string identifier for the navigation item. May be used in hooks to
   * augment navigation items.
   */
  id?: string;
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
   * The description of the settings section. This will be used in search.
   */
  description?: string;
  /**
   * Is this the index settings page for this navigation config.
   */
  index?: boolean;
  /**
   * Should the navigation item be displayed?
   */
  show?: boolean | ((opts: NavigationGroupProps) => boolean);
  /**
   * Returns the text of the badge to render next to the navigation.
   */
  badge?: (opts: NavigationGroupProps) => string | number | null;
  /**
   * Should clicking on the sidebar generate an analytics event
   */
  recordAnalytics?: boolean;
};

export type NavigationSection = {
  /**
   * Heading of the navigation section
   */
  name: string;
  items: NavigationItem[];
};
