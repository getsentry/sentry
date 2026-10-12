import {IconArrow} from '@sentry/icons/arrow';
import {IconBranch} from '@sentry/icons/branch';
import {IconSentry} from '@sentry/icons/sentry';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {withFieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SOURCE_ROOT_PLACEHOLDER, STACK_ROOT_PLACEHOLDER} from './constants';
import {
  DEFAULT_BRANCH,
  normalizeRoot,
  resolveBranch,
  sanitizeBranch,
} from './normalization';
import {PathMappingDeleteButton} from './pathMappingDeleteButton';
import {PathMappingPreview} from './pathMappingPreview';
import {PathMappingWarningAlert} from './pathMappingWarningAlert';
import {PathPrefixCombobox} from './pathPrefixCombobox';
import {stackCodeMappingPrefixesOptions} from './queries';
import type {PathMappingWarning} from './warnings';

const PREFIX_MENU_MAX_HEIGHT = 250;

export const PathMappingEdit = withFieldGroup({
  defaultValues: {stackRoot: '', sourceRoot: '', branch: ''},
  props: {} as {
    defaultBranch?: string;
    hasCodeOwner?: boolean;
    onDelete?: () => void;
    projectSlug?: string;
    providerKey?: string;
    warning?: PathMappingWarning;
  },
  render: function PathMappingEditRender({
    group,
    defaultBranch,
    hasCodeOwner,
    onDelete,
    projectSlug,
    providerKey,
    warning,
  }) {
    const organization = useOrganization();
    const stackPrefixes = useQuery(
      stackCodeMappingPrefixesOptions({orgSlug: organization.slug, projectSlug})
    );

    const branchFallback = defaultBranch ?? DEFAULT_BRANCH;

    return (
      <Container containerType="inline-size" padding="xl">
        <Stack gap="xl">
          <group.AppField
            name="branch"
            listeners={{
              onBlur: ({value}) =>
                group.setFieldValue('branch', resolveBranch(value, branchFallback)),
            }}
          >
            {field => (
              <Stack gap="md">
                <Flex align="center" justify="between">
                  <Text>{t('Branch')}</Text>
                  {onDelete && (
                    <PathMappingDeleteButton
                      hasCodeOwner={hasCodeOwner}
                      onDelete={onDelete}
                      projectSlug={projectSlug}
                    />
                  )}
                </Flex>
                <field.Input
                  aria-label={t('Branch')}
                  value={field.state.value}
                  onChange={(value: string) => field.handleChange(sanitizeBranch(value))}
                  placeholder={branchFallback}
                  leadingItems={<IconBranch />}
                />
              </Stack>
            )}
          </group.AppField>

          <Grid columns={{zero: '1fr', '2xs': '1fr auto 1fr'}} gap="xl">
            <group.AppField name="stackRoot">
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
                  <PathPrefixCombobox
                    aria-label={t('Stack trace prefix')}
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={stackPrefixes.data?.prefixes ?? []}
                    isLoading={stackPrefixes.isLoading}
                    placeholder={STACK_ROOT_PLACEHOLDER}
                    disabled={hasCodeOwner}
                    menuWidth="100cqi"
                    maxMenuHeight={PREFIX_MENU_MAX_HEIGHT}
                  />
                </field.Layout.Stack>
              )}
            </group.AppField>

            <Flex
              align="center"
              paddingBottom="md"
              justify={{zero: 'center', '2xs': 'start'}}
            >
              <IconArrow direction="right" size="sm" />
            </Flex>

            <group.AppField
              name="sourceRoot"
              listeners={{
                onBlur: ({value}) =>
                  group.setFieldValue('sourceRoot', normalizeRoot(value)),
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
            </group.AppField>
          </Grid>

          <Stack gap="md" paddingTop="xl">
            <Text bold>{t('Example preview')}</Text>
            <group.Subscribe
              selector={state => ({
                stackRoot: state.values?.stackRoot ?? '',
                sourceRoot: state.values?.sourceRoot ?? '',
              })}
            >
              {({stackRoot, sourceRoot}) => (
                <PathMappingPreview
                  stackRoot={normalizeRoot(stackRoot)}
                  sourceRoot={normalizeRoot(sourceRoot)}
                />
              )}
            </group.Subscribe>
            <PathMappingWarningAlert warning={warning} projectSlug={projectSlug} />
          </Stack>
        </Stack>
      </Container>
    );
  },
});
