/**
 * Types specific to Mission Control Themes section
 */

/**
 * Represents a thematic grouping of related issues
 */
export interface Ultragroup {
  /**
   * A longer description explaining what this theme represents
   */
  description: string;

  /**
   * List of issue/group IDs that belong to this theme
   */
  issueIds: string[];

  /**
   * The title/name of the theme (e.g., "Database Connection Issues")
   */
  title: string;

  /**
   * Optional unique identifier for the ultragroup
   */
  id?: string;

  /**
   * Optional metadata for additional theme information
   */
  metadata?: {
    [key: string]: unknown;
    confidence?: number; // AI confidence score for this grouping
    createdAt?: string;
    tags?: string[];
  };
}

/**
 * Theme card data structure for the carousel
 */
export interface ThemeCardData {
  issueCount: number;
  totalEvents: number;
  ultragroup: Ultragroup;
}
