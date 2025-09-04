import type {Platform} from './sharedTypes';

export interface InstallDetailsApiResponse {
  platform: Platform;
  code_signature_errors?: string[];
  codesigning_type?: string;
  install_url?: string;
  is_code_signature_valid?: boolean;
  profile_name?: string;
}
