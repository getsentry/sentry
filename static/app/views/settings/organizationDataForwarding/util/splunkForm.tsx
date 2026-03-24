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

const splunkSchema = baseDataForwarderSchema.extend({
  instance_url: z.string().min(1, t("Instance URL is required")),
  token: z.string().min(1, t("Token is required")),
  index: z.string().min(1, t("Index is required")),
  source: z.string().min(1, t("Source is required")),
});

const splunkDefaults = {
  instance_url: "",
  token: "",
  index: "",
  source: "",
};

function buildSplunkConfig(
  fields: Omit<
    z.infer<typeof splunkSchema>,
    "is_enabled" | "enroll_new_projects" | "project_ids"
  >
): Record<string, string | undefined> {
  return {
    instance_url: fields.instance_url,
    token: fields.token,
    index: fields.index,
    source: fields.source,
  };
}

/**
 * Reusable field group for Splunk-specific configuration fields.
 */
const SplunkConfigFields = withFieldGroup({
  defaultValues: splunkDefaults,
  props: { disabled: false },
  render: ({ group, disabled }) => (
    <group.FieldGroup title={t("Global Configuration")}>
      <group.AppField name="instance_url">
        {(field) => (
          <field.Layout.Row
            label={t("Instance URL")}
            hintText={t(
              "The HTTP Event Collector endpoint for your Splunk instance. Ensure indexer acknowledgement is disabled."
            )}
            required
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder="e.g. https://input-foo.cloud.splunk.com:8088"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </group.AppField>
      <group.AppField name="token">
        {(field) => (
          <field.Layout.Row
            label={t("Token")}
            hintText={t("The token generated for your HTTP Event Collector.")}
            required
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder="e.g. ab13cdef-45aa-1bcd-a123-bcEXAMPLEKEY"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </group.AppField>
      <group.AppField name="index">
        {(field) => (
          <field.Layout.Row
            label={t("Index")}
            hintText={t("The index to use for the events.")}
            required
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder="e.g. main"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </group.AppField>
      <group.AppField name="source">
        {(field) => (
          <field.Layout.Row
            label={t("Source")}
            hintText={t("The source to use for the events.")}
            required
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder="e.g. sentry"
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </group.AppField>
    </group.FieldGroup>
  ),
});

export function SplunkSetupForm({
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
    defaultValues: { ...baseFormSetupDefaults, ...splunkDefaults },
    validators: { onDynamic: splunkSchema },
    onSubmit: ({ value }) => {
      const {
        is_enabled: _is_enabled,
        enroll_new_projects,
        project_ids = [],
        ...configFields
      } = value;
      onSubmit({
        provider: DataForwarderProviderSlug.SPLUNK,
        config: buildSplunkConfig(configFields),
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
        <SplunkConfigFields
          form={form}
          fields={{
            instance_url: "instance_url",
            token: "token",
            index: "index",
            source: "source",
          }}
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

export function SplunkEditForm({
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
      ...splunkDefaults,
      ...dataForwarder.config,
    },
    validators: { onDynamic: splunkSchema },
    onSubmit: ({ value }) => {
      const {
        is_enabled,
        enroll_new_projects,
        project_ids = [],
        ...configFields
      } = value;
      onSubmit({
        provider: DataForwarderProviderSlug.SPLUNK,
        config: buildSplunkConfig(configFields),
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
        <SplunkConfigFields
          form={form}
          fields={{
            instance_url: "instance_url",
            token: "token",
            index: "index",
            source: "source",
          }}
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
