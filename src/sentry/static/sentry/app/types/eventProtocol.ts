interface Frame {
  filename?: string;
  function?: string;
  module?: string;
  platform?: string;
  lineno?: number;
  colno?: number;
  absPath?: string;
  context_line?: string;
  preContext?: string[];
  postContext?: string[];
  inApp?: boolean;
  vars?: {[key: string]: any};
}
