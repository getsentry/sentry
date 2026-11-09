export type GuideStep = {
  /**
   * The main body of the step
   */
  description: React.ReactNode;
  /**
   * Step is tied to an anchor target. If the anchor doesn't exist, the step
   * will not be shown.
   */
  target: string;
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
   * Anchors that are expected to appear when the step is reached. This may be
   * useful when a previous step triggers an element which includes the next
   * anchor.
   */
  expectedTargets?: string[];
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

export type GuidesServerData = Array<{
  /**
   * Guide key
   */
  guide: string;
  /**
   * Has this guide already been seen?
   */
  seen: boolean;
}>;
