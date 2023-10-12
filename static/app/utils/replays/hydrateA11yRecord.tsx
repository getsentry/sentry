export interface A11yIssue {
  elements: A11yIssueElement[];
  help: string;
  help_url: string;
  id: string;
  timestamp: number;
  impact?: 'minor' | 'moderate' | 'serious' | 'critical';
}

interface A11yIssueElement {
  alternatives: A11yIssueElementAlternative[];
  element: string;
  target: string[];
}

interface A11yIssueElementAlternative {
  id: string;
  message: string;
}

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export type HydratedA11yIssue = Overwrite<
  A11yIssue,
  {
    /**
     * The difference in timestamp and replay.started_at, in millieseconds
     */
    offsetMs: number;
    /**
     * The Date when the breadcrumb happened
     */
    timestamp: Date;
    /**
     * Alias of timestamp, in milliseconds
     */
    timestampMs: number;
  }
>;

export default function hydrateA11yIssue(
  raw: A11yIssue,
  startTimestampMs: number
): HydratedA11yIssue {
  const timestamp = new Date(raw.timestamp);
  return {
    ...raw,
    offsetMs: 0,
    timestamp,
    timestampMs: Math.abs(timestamp.getTime() - startTimestampMs),
  };
}
