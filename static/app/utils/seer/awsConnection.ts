import {z} from 'zod';

export interface AwsVerificationResult {
  connectionStatus: string;
  externalIdRequired: boolean;
  regions: Array<{
    connectionStatus: string;
    region: string;
    services: Array<{
      service: string;
      status: string;
      errorDetail?: string | null;
    }>;
    errorDetail?: string | null;
  }>;
  errorDetail?: string | null;
}

export function canConnectAws(result: AwsVerificationResult | null | undefined): boolean {
  return Boolean(
    result?.externalIdRequired &&
    result.regions.some(region => region.connectionStatus === 'connected')
  );
}

const storedVerificationSchema = z.object({
  connection_status: z.string(),
  external_id_required: z.boolean(),
  error_detail: z.string().nullable().optional(),
  regions: z.array(
    z.object({
      region: z.string(),
      connection_status: z.string(),
      error_detail: z.string().nullable().optional(),
      services: z.array(
        z.object({
          service: z.string(),
          status: z.string(),
          error_detail: z.string().nullable().optional(),
        })
      ),
    })
  ),
});

export function getStoredAwsVerification(value: unknown): AwsVerificationResult | null {
  const parsed = storedVerificationSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const result = parsed.data;
  return {
    connectionStatus: result.connection_status,
    externalIdRequired: result.external_id_required,
    errorDetail: result.error_detail,
    regions: result.regions.map(region => ({
      region: region.region,
      connectionStatus: region.connection_status,
      errorDetail: region.error_detail,
      services: region.services.map(service => ({
        service: service.service,
        status: service.status,
        errorDetail: service.error_detail,
      })),
    })),
  };
}
