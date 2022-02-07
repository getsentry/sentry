import {combineStatus} from './utils';

export type DebugStatus = ReturnType<typeof combineStatus>;

export type DebugImage = {
  code_file: string;
  debug_id: string;
  image_addr: string;
  image_size: number;
  type: string;
  arch?: string;
  code_id?: string;
  debug_file?: string;
  debug_status?: DebugStatus;
  features?: {
    has_debug_info: boolean;
    has_sources: boolean;
    has_symbols: boolean;
    has_unwind_info: boolean;
  };
  image_vmaddr?: string;
  unwind_status?: DebugStatus;
};
