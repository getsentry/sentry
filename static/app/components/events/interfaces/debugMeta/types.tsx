import {combineStatus} from './utils';

export type DebugStatus = ReturnType<typeof combineStatus>;

export type DebugImage = {
  code_file: string;
  debug_id: string;
  image_addr: string;
  image_size: number;
  type: string;
  debug_status?: DebugStatus;
  unwind_status?: DebugStatus;
  image_vmaddr?: string;
  arch?: string;
  debug_file?: string;
  features?: {
    has_sources: boolean;
    has_debug_info: boolean;
    has_unwind_info: boolean;
    has_symbols: boolean;
  };
  code_id?: string;
};
