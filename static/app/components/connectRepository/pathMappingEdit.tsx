import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow, IconBranch, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

import {SOURCE_ROOT_PLACEHOLDER, STACK_ROOT_PLACEHOLDER} from './constants';
import {
  DEFAULT_BRANCH,
  normalizedPathMappingSchema,
  normalizeRoot,
  resolveBranch,
  sanitizeBranch,
} from './normalization';
import {PathMappingDeleteButton} from './pathMappingDeleteButton';
import {PathMappingPreview} from './pathMappingPreview';
import {PathMappingWarningAlert} from './pathMappingWarningAlert';
import type {PathMappingValue} from './type';
import type {PathMappingWarning} from './warnings';

// Non-transforming schema used only for the form's onDynamic validator.
const schema = z.object({
  stackRoot: z.string(),
  sourceRoot: z.string(),
  branch: z.string(),
});

interface PathMappingEditProps extends PathMappingValue {
  onChange: (value: PathMappingValue) => void;
  defaultBranch?: string;
  onDelete?: () => void;
  projectSlug?: string;
  providerKey?: string;
  warning?: PathMappingWarning | null;
}

export function PathMappingEdit({
  branch,
  sourceRoot,
  stackRoot,
  hasCodeOwner,
  onChange,
  onDelete,
  defaultBranch,
  projectSlug,
  providerKey,
  warning,
}: PathMappingEditProps) {
  const branchFallback = defaultBranch ?? DEFAULT_BRANCH;
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {stackRoot, sourceRoot, branch},
    validators: {onDynamic: schema},
    listeners: {
      onChange: ({formApi}) => {
        const values = formApi.state.values;
        onChange({...values, branch: resolveBranch(values.branch, branchFallback)});
      },
    },
    onSubmit: () => {},
  });

  return (
    <form.AppForm form={form}>
      <Container containerType="inline-size" padding="xl">
        <Stack gap="xl">
          <Container position="relative">
            {onDelete && (
              <Container position="absolute" style={{top: 0, right: 0}}>
                <PathMappingDeleteButton
                  hasCodeOwner={hasCodeOwner}
                  onDelete={onDelete}
                />
              </Container>
            )}
            <form.AppField name="branch">
              {field => (
                <field.Layout.Stack label={t('Branch')}>
                  <field.Base<HTMLInputElement>>
                    {(baseProps, {indicator}) => (
                      <InputGroup style={{flex: 1}}>
                        <InputGroup.LeadingItems disablePointerEvents>
                          <IconBranch />
                        </InputGroup.LeadingItems>
                        <InputGroup.Input
                          {...baseProps}
                          value={field.state.value}
                          placeholder={branchFallback}
                          onChange={e =>
                            field.handleChange(sanitizeBranch(e.target.value))
                          }
                        />
                        <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
                      </InputGroup>
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Container>

          <Grid columns={{zero: '1fr', '2xs': '1fr auto 1fr'}} gap="xl">
            <form.AppField
              name="stackRoot"
              listeners={{
                onBlur: ({value: v}) => form.setFieldValue('stackRoot', normalizeRoot(v)),
              }}
            >
              {field => (
                <field.Layout.Stack
                  label={
                    <Flex gap="xs" align="center">
                      <IconSentry size="xs" />
                      {t('Stack trace prefix')}
                      <Tag variant="muted">{t('Match')}</Tag>
                    </Flex>
                  }
                  hintText={t('The start of the paths in your stack traces.')}
                >
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={STACK_ROOT_PLACEHOLDER}
                    disabled={hasCodeOwner}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>

            <Flex
              align="center"
              paddingBottom="md"
              justify={{zero: 'center', '2xs': 'start'}}
            >
              <IconArrow direction="right" size="sm" />
            </Flex>

            <form.AppField
              name="sourceRoot"
              listeners={{
                onBlur: ({value: v}) =>
                  form.setFieldValue('sourceRoot', normalizeRoot(v)),
              }}
            >
              {field => (
                <field.Layout.Stack
                  label={
                    <Flex gap="xs" align="center">
                      {providerKey && getIntegrationIcon(providerKey, 'xs')}
                      {t('Repository prefix')}
                      <Tag variant="muted">{t('Replace with')}</Tag>
                    </Flex>
                  }
                  hintText={t(
                    'What to replace it with, so the path points to your repo.'
                  )}
                >
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={SOURCE_ROOT_PLACEHOLDER}
                    disabled={hasCodeOwner}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Grid>

          <Stack gap="md" paddingTop="xl">
            <Text bold>{t('Example preview')}</Text>
            <form.Subscribe
              selector={state => ({
                stackRoot: state.values.stackRoot,
                sourceRoot: state.values.sourceRoot,
              })}
            >
              {previewValue => {
                const {stackRoot: previewStackRoot, sourceRoot: previewSourceRoot} =
                  normalizedPathMappingSchema.parse({...previewValue, branch: ''});

                return (
                  <PathMappingPreview
                    stackRoot={previewStackRoot}
                    sourceRoot={previewSourceRoot}
                  />
                );
              }}
            </form.Subscribe>
            <PathMappingWarningAlert warning={warning} projectSlug={projectSlug} />
          </Stack>
        </Stack>
      </Container>
    </form.AppForm>
  );
}
