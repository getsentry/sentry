import { z } from "zod";

import { Button } from "@sentry/scraps/button";
import {
  defaultFormOptions,
  useScrapsForm,
  withFieldGroup,
} from "@sentry/scraps/form";
import { Flex } from "@sentry/scraps/layout";

import { IconDelete } from "sentry/icons";
import { t } from "sentry/locale";
import type { Project } from "sentry/types/project";
import { DataForwarderDeleteConfirm } from "sentry/views/settings/organizationDataForwarding/components/dataForwarderDeleteConfirm";
import {
  baseDataForwarderSchema,
  baseFormEditDefaults,
  baseFormSetupDefaults,
  buildProjectOptions,
  EnablementFields,
  ProjectConfigFields,
} from "sentry/views/settings/organizationDataForwarding/util/forms";
import {
  DataForwarderProviderSlug,
  type DataForwarder,
  type DataForwarderPayload,
} from "sentry/views/settings/organizationDataForwarding/util/types";

const segmentSchema = baseDataForwarderSchema.extend({
  write_key: z.string().min(1, t("Write key is required")),
});

const segmentDefaults = {
  write_key: "",
};

function buildSegmentConfig(
  fields: Omit<
    z.infer<typeof segmentSchema>,
    "is_enabled" | "enroll_new_projects" | "project_ids"
  >
): Record<string, string | undefined> {
  return { write_key: fields.write_key };
}

/**
 * Reusable field group for Segment-specific configuration fields.
 */
const SegmentConfigFields = withFieldGroup({
  defaultValues: segmentDefaults,
  props: { disabled: false },
  render: ({ group, disabled }) => (
    <group.FieldGroup title={t("Global Configuration")}>
      <group.AppField name="write_key">
        {(field) => (
          <field.Layout.Row
            label={t("Write Key")}
            hintText={t(
              "Add an HTTP API Source to your Segment workspace to generate a write key."
            )}
            required
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder="e.g. itA5bLOPNxccvZ9ON1NYg9EXAMPLEKEY"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </group.AppField>
    </group.FieldGroup>
  ),
});

export function SegmentSetupForm({
  projects,
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (payload: DataForwarderPayload) => void;
  projects: Project[];
}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: { ...baseFormSetupDefaults, ...segmentDefaults },
    validators: { onDynamic: segmentSchema },
    onSubmit: ({ value }) => {
      const {
        is_enabled: _is_enabled,
        enroll_new_projects,
        project_ids = [],
        ...configFields
      } = value;
      onSubmit({
        provider: DataForwarderProviderSlug.SEGMENT,
        config: buildSegmentConfig(configFields),
        is_enabled: true,
        enroll_new_projects,
        project_ids,
      } satisfies DataForwarderPayload);
    },
  });

  const projectOptions = buildProjectOptions(projects);

  return (
    <form.AppForm>
      <form.FormWrapper>
        <EnablementFields
          form={form}
          fields={{ is_enabled: "is_enabled" }}
          disabled={disabled}
          isSetup
        />
        <SegmentConfigFields
          form={form}
          fields={{ write_key: "write_key" }}
          disabled={disabled}
        />
        <ProjectConfigFields
          form={form}
          fields={{
            enroll_new_projects: "enroll_new_projects",
            project_ids: "project_ids",
          }}
          disabled={disabled}
          projectOptions={projectOptions}
        />
        <Flex justify="end" padding="lg">
          <form.SubmitButton disabled={disabled}>
            {t("Complete Setup")}
          </form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}

export function SegmentEditForm({
  dataForwarder,
  projects,
  disabled,
  onSubmit,
}: {
  dataForwarder: DataForwarder;
  disabled: boolean;
  onSubmit: (payload: DataForwarderPayload) => void;
  projects: Project[];
}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      ...baseFormEditDefaults(dataForwarder),
      ...segmentDefaults,
      ...dataForwarder.config,
    },
    validators: { onDynamic: segmentSchema },
    onSubmit: ({ value }) => {
      const {
        is_enabled,
        enroll_new_projects,
        project_ids = [],
        ...configFields
      } = value;
      onSubmit({
        provider: DataForwarderProviderSlug.SEGMENT,
        config: buildSegmentConfig(configFields),
        is_enabled,
        enroll_new_projects,
        project_ids,
      } satisfies DataForwarderPayload);
    },
  });

  const projectOptions = buildProjectOptions(projects);

  return (
    <form.AppForm>
      <form.FormWrapper>
        <EnablementFields
          form={form}
          fields={{ is_enabled: "is_enabled" }}
          disabled={disabled}
          isSetup={false}
        />
        <SegmentConfigFields
          form={form}
          fields={{ write_key: "write_key" }}
          disabled={disabled}
        />
        <ProjectConfigFields
          form={form}
          fields={{
            enroll_new_projects: "enroll_new_projects",
            project_ids: "project_ids",
          }}
          disabled={disabled}
          projectOptions={projectOptions}
        />
        <Flex justify="end" gap="md" padding="lg 0">
          <DataForwarderDeleteConfirm dataForwarder={dataForwarder}>
            <Button icon={<IconDelete variant="danger" />}>
              {t("Delete Data Forwarder")}
            </Button>
          </DataForwarderDeleteConfirm>
          <form.SubmitButton disabled={disabled}>
            {t("Update Forwarder")}
          </form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}
