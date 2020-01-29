export interface Thread {
  id: string;
  name?: string;
  crashed?: boolean;
  stacktrace?: any;
  rawStacktrace?: any;
}

export interface Frame {
  function?: string;
  package?: string;
  module?: string;
  filename?: string;
}
