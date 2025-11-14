import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import RangeField from 'sentry/components/forms/fields/rangeField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';

interface JsonSchemaDetectorFormProps {
  detectorType: DetectorType;
  detector?: Detector;
  initialFormData?: any;
}

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

// API returns a dictionary mapping detector type slug to config schema
type DetectorTypesResponse = Record<string, JsonSchema>;

function useDetectorTypeSchema(detectorType: DetectorType) {
  const organization = useOrganization();
  const queryKey: ApiQueryKey = [`/organizations/${organization.slug}/detector-types/`];

  const {data: detectorTypes, isLoading} = useApiQuery<DetectorTypesResponse>(queryKey, {
    staleTime: 60000, // Cache for 1 minute
  });

  const schema = useMemo(() => {
    if (!detectorTypes) {
      return null;
    }
    return detectorTypes[detectorType] || null;
  }, [detectorTypes, detectorType]);

  return {schema, isLoading};
}

function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function JsonSchemaFormField({
  fieldName,
  property,
  isRequired,
}: {
  fieldName: string;
  isRequired: boolean;
  property: JsonSchemaProperty;
}) {
  // Backend returns config in camelCase, so use camelCase for form field keys
  const camelFieldName = snakeToCamelCase(fieldName);
  const fieldKey = `config.${camelFieldName}`;
  const label = fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Handle array type
  if (property.type === 'array') {
    return (
      <TextField
        name={fieldKey}
        label={label}
        help={property.description}
        placeholder={property.default ? String(property.default) : undefined}
        required={isRequired}
      />
    );
  }

  // Handle enum type (select dropdown)
  if (property.enum) {
    return (
      <SelectField
        name={fieldKey}
        label={label}
        help={property.description}
        options={property.enum.map(value => ({
          label: String(value),
          value,
        }))}
        required={isRequired}
      />
    );
  }

  // Handle number type
  if (property.type === 'integer' || property.type === 'number') {
    return (
      <RangeField
        name={fieldKey}
        label={label}
        help={property.description}
        placeholder={property.default ? String(property.default) : undefined}
        min={property.minimum}
        max={property.maximum}
        required={isRequired}
      />
    );
  }

  // Default to text field
  return (
    <TextField
      name={fieldKey}
      label={label}
      help={property.description}
      placeholder={property.default ? String(property.default) : undefined}
      required={isRequired}
    />
  );
}

function JsonSchemaDetectorFormFields({detectorType}: {detectorType: DetectorType}) {
  const {schema, isLoading} = useDetectorTypeSchema(detectorType);

  if (isLoading) {
    return <div>{t('Loading...')}</div>;
  }

  if (!schema?.properties) {
    return <div>{t('No configuration schema available')}</div>;
  }

  const requiredFields = new Set(schema.required || []);

  return (
    <FormStack>
      {schema.description && (
        <Container>
          <Section title={t('Description')}>
            <Text as="p">{schema.description}</Text>
          </Section>
        </Container>
      )}
      <Container>
        <Section title={t('Configure')}>
          {Object.entries(schema.properties).map(([fieldName, property]) => (
            <JsonSchemaFormField
              key={fieldName}
              fieldName={fieldName}
              property={property}
              isRequired={requiredFields.has(fieldName)}
            />
          ))}
        </Section>
      </Container>
    </FormStack>
  );
}

export function EditExistingJsonSchemaDetectorForm({detector}: {detector: Detector}) {
  const {schema} = useDetectorTypeSchema(detector.type);

  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={formData =>
        jsonSchemaDetectorFormDataToEndpointPayload(formData, detector.type, schema)
      }
      savedDetectorToFormData={jsonSchemaSavedDetectorToFormData}
    >
      <JsonSchemaDetectorFormFields detectorType={detector.type} />
    </EditDetectorLayout>
  );
}

export function NewJsonSchemaDetectorForm({
  detectorType,
  initialFormData,
}: JsonSchemaDetectorFormProps) {
  const {schema} = useDetectorTypeSchema(detectorType);

  // Build default initial form data from schema defaults
  // Flatten config keys to match form field names (e.g., config.durationThreshold)
  const defaultFormData = useMemo(() => {
    if (!schema?.properties) {
      return {};
    }
    const formData: Record<string, any> = {};
    Object.entries(schema.properties).forEach(([key, prop]) => {
      if (prop.default !== undefined) {
        const camelKey = snakeToCamelCase(key);
        formData[`config.${camelKey}`] = prop.default;
      }
    });
    return formData;
  }, [schema]);

  const defaultInitialFormData = initialFormData || {
    name: '',
    owner: null,
    description: '',
    enabled: true,
    ...defaultFormData,
  };

  return (
    <NewDetectorLayout
      detectorType={detectorType}
      formDataToEndpointPayload={formData =>
        jsonSchemaDetectorFormDataToEndpointPayload(formData, detectorType, schema)
      }
      initialFormData={defaultInitialFormData}
    >
      <JsonSchemaDetectorFormFields detectorType={detectorType} />
    </NewDetectorLayout>
  );
}

function jsonSchemaDetectorFormDataToEndpointPayload(
  formData: any,
  detectorType: DetectorType,
  schema: JsonSchema | null
) {
  // Form data has flattened config keys (e.g., config.durationThreshold)
  // Reconstruct nested config object for backend
  const config: Record<string, any> = {};

  // Extract all config.* keys from form data
  Object.entries(formData).forEach(([key, value]) => {
    if (key.startsWith('config.')) {
      const configKey = key.replace('config.', '');
      // Find the schema property by converting camelCase back to snake_case for lookup
      const snakeKey = configKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const propertySchema = schema?.properties?.[snakeKey];

      if (propertySchema?.type === 'array' && typeof value === 'string') {
        // Convert comma-separated string to array
        config[configKey] = value
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else {
        config[configKey] = value;
      }
    }
  });

  return {
    name: formData.name,
    type: detectorType,
    owner: formData.owner || null,
    description: formData.description || null,
    enabled: formData.enabled === undefined ? true : formData.enabled,
    projectId: formData.projectId,
    workflowIds: formData.workflowIds || [],
    config,
    dataSources: [],
  };
}

function jsonSchemaSavedDetectorToFormData(detector: any) {
  // Use backend data directly - it's already in camelCase
  // Flatten config into form field keys (e.g., config.durationThreshold)
  // For array fields, convert to comma-separated strings for form display
  const formData: Record<string, any> = {
    name: detector.name,
    type: detector.type,
    owner: detector.owner,
    description: detector.description || '',
    enabled: detector.enabled,
    projectId: detector.projectId,
    workflowIds: detector.workflowIds || [],
  };

  if (detector.config) {
    Object.entries(detector.config).forEach(([key, value]) => {
      const fieldKey = `config.${key}`;
      if (Array.isArray(value)) {
        formData[fieldKey] = value.join(', ');
      } else {
        formData[fieldKey] = value;
      }
    });
  }

  return formData;
}

const FormStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
