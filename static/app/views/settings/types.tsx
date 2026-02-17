import type {ComponentType, ReactElement, ReactNode} from 'react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

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

export type NavigationSubSection = {
  /**
   * Unique identifier for the subsection
   */
  id: string;
  items: NavigationItem[];
  /**
   * Heading of the subsection
   */
  name: string;
  /**
   * Icon displayed before the subsection title
   */
  icon?: ComponentType<SVGIconProps>;
};

export type NavigationSection = {
  /**
   * Unique identifier for the navigation section, used to save collapsed state
   */
  id: string;
  items: NavigationItem[];
  /**
   * Heading of the navigation section
   */
  name: string;
  /**
   * Static icon component displayed before the section title
   */
  icon?: ComponentType<SVGIconProps>;
  /**
   * Render function for dynamic icons (e.g. avatars) that need access to navigation props.
   * Takes precedence over `icon` when both are provided.
   */
  renderIcon?: (opts: NavigationProps) => ReactNode;
  /**
   * Nested subsections rendered within this section
   */
  subsections?: NavigationSubSection[];
};
