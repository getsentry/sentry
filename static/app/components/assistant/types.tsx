export type GuideStep = {
  /**
   * The main body of the step
   */
  description: React.ReactNode;
  /**
   * Disables dismissal
   */
  cantDismiss?: boolean;
  /**
   * Label for the dismiss button
   */
  dismissText?: string;
  hasNextGuide?: boolean;
  /**
   * Label for the next button
   */
  nextText?: string;
  /**
   * Step is tied to an anchor target. If the anchor doesn't exist, the step
   * will not be shown. If the anchor exists but is of type "invisible", it will
   * not be pinged but will be scrolled to. Otherwise the anchor will be pinged
   * and scrolled to.
   */
  target?: string;
  /**
   * The main title of the step
   */
  title?: string;
};

type BaseGuide = {
  guide: string;
  /**
   * Anchor targets required on the page. An empty list will cause the
   * guide to be shown regardless.
   */
  requiredTargets: string[];
  steps: GuideStep[];
  /**
   * Show the guide to users who've joined before the date threshold
   */
  dateThreshold?: Date;
  /**
   * When dismissing a guide on the same page, all subsequent guides
   * will be marked as seen.
   *
   * Note that on a page refresh, the subsequent guides will be visible still.
   */
  markOthersAsSeen?: boolean;
  /**
   * When two guides could be active, the guide with the lower priority value
   * level takes precedent.
   */
  priority?: number;
};

export type Guide = BaseGuide & {
  /**
   * Has this guide already been seen?
   */
  seen: boolean;
};

export type GuidesContent = BaseGuide[];

export type GuidesServerData = {
  /**
   * Guide key
   */
  guide: string;
  /**
   * Has this guide already been seen?
   */
  seen: boolean;
}[];
