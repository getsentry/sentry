import type {Frame as FrameType} from 'sentry/types';

export function Frame(props: Partial<FrameType> = {}): FrameType {
  return {
    absPath: 'abs/path/to/file.js',
    colNo: null,
    lineNo: null,
    context: [],
    filename: 'file.js',
    function: 'functionName',
    inApp: true,
    instructionAddr: '0x0000000',
    module: 'abs.path.to:file',
    package: null,
    platform: 'javascript',
    rawFunction: 'functionName',
    symbol: 'functionName',
    symbolAddr: '0x0000000',
    trust: 'none',
    vars: {},
    ...props,
  };
}
