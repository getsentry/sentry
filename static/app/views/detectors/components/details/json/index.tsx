import {Text} from 'sentry/components/core/text';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';

type JsonSchemaDetectorDetailsProps = {
  detector: Detector;
  project: Project;
};

interface JsonSchemaProperty {
  type: string | string[];
  default?: any;
  description?: string;
  enum?: any[];
  items?: {type: string};
  maximum?: number;
  minimum?: number;
}

interface JsonSchema {
  properties: Record<string, JsonSchemaProperty>;
  type: string;
  description?: string;
  required?: string[];
}

type DetectorTypesResponse = Record<string, JsonSchema>;

function useDetectorTypeSchema(detectorType: string) {
  const organization = useOrganization();
  const queryKey: ApiQueryKey = [`/organizations/${organization.slug}/detector-types/`];

  const {data: detectorTypes, isLoading} = useApiQuery<DetectorTypesResponse>(queryKey, {
    staleTime: 60000, // Cache for 1 minute
  });

  const schema = detectorTypes?.[detectorType] || null;

  return {schema, isLoading};
}

function formatConfigValue(value: any): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value ?? '-');
}

function ConfigSection({detector}: {detector: Detector}) {
  const {schema, isLoading} = useDetectorTypeSchema(detector.type);

  if (isLoading || !schema) {
    return null;
  }

  const config = detector.config || {};
  const requiredFields = new Set(schema.required || []);

  return (
    <Section title={t('Configuration')}>
      {Object.entries(schema.properties).map(([fieldName, property]) => {
        // Convert snake_case to camelCase to match API response format
        const camelKey = fieldName.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        const value =
          config[camelKey as keyof typeof config] ??
          config[fieldName as keyof typeof config];
        const label = fieldName
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        const isRequired = requiredFields.has(fieldName);

        return (
          <div key={fieldName} style={{marginBottom: '1rem'}}>
            <Text bold>
              {label}
              {isRequired && <Text variant="muted"> *</Text>}
            </Text>
            {property.description && (
              <Text as="p" variant="muted" size="sm">
                {property.description}
              </Text>
            )}
            <Text as="p">{formatConfigValue(value)}</Text>
          </div>
        );
      })}
    </Section>
  );
}

export function JsonSchemaDetectorDetails({
  detector,
  project,
}: JsonSchemaDetectorDetailsProps) {
  const {schema} = useDetectorTypeSchema(detector.type);

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DatePageFilter />
          <DetectorDetailsOngoingIssues detector={detector} />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          {schema?.description && (
            <Section title={t('About')}>
              <Text as="p">{schema.description}</Text>
            </Section>
          )}
          <ConfigSection detector={detector} />
          <DetectorExtraDetails>
            <DetectorExtraDetails.DateCreated detector={detector} />
            <DetectorExtraDetails.CreatedBy detector={detector} />
            <DetectorExtraDetails.LastModified detector={detector} />
            <DetectorExtraDetails.Environment detector={detector} />
          </DetectorExtraDetails>
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
