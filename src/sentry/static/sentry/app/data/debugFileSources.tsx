export const DEBUG_SOURCE_LAYOUTS = {
  native: 'Platform-Specific (SymStore / GDB / LLVM)',
  symstore: 'Microsoft SymStore',
  symstore_index2: 'Microsoft SymStore (with index2.txt)',
  ssqp: 'Microsoft SSQP',
  unified: 'Unified Symbol Server Layout',
  debuginfod: 'debuginfod',
} as const;

export const DEBUG_SOURCE_CASINGS = {
  default: 'Default (mixed case)',
  uppercase: 'Uppercase',
  lowercase: 'Lowercase',
} as const;

export const AWS_REGIONS = [
  ['us-east-2', 'US East (Ohio)'],
  ['us-east-1', 'US East (N. Virginia)'],
  ['us-west-1', 'US West (N. California)'],
  ['us-west-2', 'US West (Oregon)'],
  ['ap-east-1', 'Asia Pacific (Hong Kong)'],
  ['ap-south-1', 'Asia Pacific (Mumbai)'],
  // ['ap-northeast-3', 'Asia Pacific (Osaka-Local)'],
  ['ap-northeast-2', 'Asia Pacific (Seoul)'],
  ['ap-southeast-1', 'Asia Pacific (Singapore)'],
  ['ap-southeast-2', 'Asia Pacific (Sydney)'],
  ['ap-northeast-1', 'Asia Pacific (Tokyo)'],
  ['ca-central-1', 'Canada (Central)'],
  ['cn-north-1', 'China (Beijing)'],
  ['cn-northwest-1', 'China (Ningxia)'],
  ['eu-central-1', 'EU (Frankfurt)'],
  ['eu-west-1', 'EU (Ireland)'],
  ['eu-west-2', 'EU (London)'],
  ['eu-west-3', 'EU (Paris)'],
  ['eu-north-1', 'EU (Stockholm)'],
  ['sa-east-1', 'South America (São Paulo)'],
  ['us-gov-east-1', 'AWS GovCloud (US-East)'],
  ['us-gov-west-1', 'AWS GovCloud (US)'],
] as const;

export const DEBUG_SOURCE_TYPES = {
  gcs: 'Google Cloud Storage',
  http: 'SymbolServer (HTTP)',
  s3: 'Amazon S3',
} as const;

export function getDebugSourceName(type: keyof typeof DEBUG_SOURCE_TYPES) {
  return DEBUG_SOURCE_TYPES[type] ?? 'Unknown';
}
