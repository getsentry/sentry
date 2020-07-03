export type GuideStep = {
  title: string;
  /**
   * Step is tied to an anchor target. If the anchor doesn't exist,
   * the step will not be shown. If the anchor exists but is of type
   * "invisible", it will not be pinged but will be scrolled to.
   * Otherwise the anchor will be pinged and scrolled to.
   */
  target?: string;
  description: React.ReactNode;
};

export type Guide = {
  guide: string;
  requiredTargets: string[];
  steps: GuideStep[];
  seen: boolean;
};

export type GuidesContent = {
  guide: string;
  /**
   * Anchor targets required on the page. An empty list will cause the
   * guide to be shown regardless.
   */
  requiredTargets: string[];
  steps: GuideStep[];
}[];

export type GuidesServerData = {
  guide: string;
  seen: boolean;
}[];
