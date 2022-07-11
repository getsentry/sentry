export interface VitalsResult {
  FCP: number | null;
  LCP: number | null;
  appStartCold: number | null;
  appStartWarm: number | null;
}

export type VitalsKey = keyof VitalsResult;
