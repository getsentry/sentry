import {IconArrow} from '@sentry/icons/arrow';
import {IconBranch} from '@sentry/icons/branch';
import {IconSentry} from '@sentry/icons/sentry';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {defineAppFieldGroup, useSelector} from '@sentry/scraps/form';
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
import {repoCodeMappingPrefixesOptions, stackCodeMappingPrefixesOptions} from './queries';
import type {PathMappingWarning} from './warnings';

const PREFIX_MENU_WIDTH = '100cqi';
const PREFIX_MENU_MAX_HEIGHT = 250;

const pathMappingFieldGroup = defineAppFieldGroup(({strict}) => ({
  stackRoot: strict<string>(),
  sourceRoot: strict<string>(),
  branch: strict<string>(),
}));

type Props = {
  fields: typeof pathMappingFieldGroup.fields;
  defaultBranch?: string;
  hasCodeOwner?: boolean;
  onDelete?: () => void;
  projectSlug?: string;
  providerKey?: string;
  repositoryId?: string;
  warning?: PathMappingWarning;
};

function PathMappingEditImpl({
  fields,
  defaultBranch,
  hasCodeOwner,
  onDelete,
  projectSlug,
  providerKey,
  repositoryId,
  warning,
}: Props) {
  const {stackRoot, sourceRoot} = useSelector(fields.atom, values => values);
  const organization = useOrganization();
  const stackPrefixes = useQuery(
    stackCodeMappingPrefixesOptions({orgSlug: organization.slug, projectSlug})
  );
  const repoPrefixes = useQuery(
    repoCodeMappingPrefixesOptions({orgSlug: organization.slug, repositoryId})
  );
  const branchFallback = defaultBranch ?? DEFAULT_BRANCH;

  return (
    <Container containerType="inline-size" padding="xl">
      <Stack gap="xl">
        <fields.Field
          name="branch"
          listeners={[
            {
              run: ({value, fieldApi}) =>
                fieldApi.handleChange(resolveBranch(value, branchFallback)),
              triggers: ['blur'],
            },
          ]}
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
                value={field.value}
                onChange={(value: string) => field.handleChange(sanitizeBranch(value))}
                placeholder={branchFallback}
                leadingItems={<IconBranch />}
              />
            </Stack>
          )}
        </fields.Field>

        <Grid columns={{zero: '1fr', '2xs': '1fr auto 1fr'}} gap="xl">
          <fields.Field name="stackRoot">
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
                <field.Base<HTMLInputElement> disabled={hasCodeOwner}>
                  {({ref: _ref, ...baseProps}) => (
                    <Container flex={1} minWidth={0}>
                      <PathPrefixCombobox
                        {...baseProps}
                        aria-label={t('Stack trace prefix')}
                        value={field.value}
                        onChange={field.handleChange}
                        options={stackPrefixes.data?.prefixes ?? []}
                        isLoading={stackPrefixes.isLoading}
                        placeholder={STACK_ROOT_PLACEHOLDER}
                        menuWidth={PREFIX_MENU_WIDTH}
                        maxMenuHeight={PREFIX_MENU_MAX_HEIGHT}
                      />
                    </Container>
                  )}
                </field.Base>
              </field.Layout.Stack>
            )}
          </fields.Field>

          <Flex
            align="center"
            paddingBottom="md"
            justify={{zero: 'center', '2xs': 'start'}}
          >
            <IconArrow direction="right" size="sm" />
          </Flex>

          <fields.Field name="sourceRoot">
            {field => (
              <field.Layout.Stack
                label={
                  <Flex gap="xs" align="center">
                    {providerKey && getIntegrationIcon(providerKey, 'xs')}
                    {t('Repository prefix')}
                    <Tag variant="muted">{t('Replace with')}</Tag>
                  </Flex>
                }
                hintText={t('What to replace it with, so the path points to your repo.')}
              >
                <field.Base<HTMLInputElement> disabled={hasCodeOwner}>
                  {({ref: _ref, ...baseProps}) => (
                    <Container flex={1} minWidth={0}>
                      <PathPrefixCombobox
                        {...baseProps}
                        aria-label={t('Repository prefix')}
                        value={field.value}
                        onChange={field.handleChange}
                        options={repoPrefixes.data?.prefixes ?? []}
                        isLoading={repoPrefixes.isLoading}
                        placeholder={SOURCE_ROOT_PLACEHOLDER}
                        menuAlign="end"
                        menuWidth={PREFIX_MENU_WIDTH}
                        maxMenuHeight={PREFIX_MENU_MAX_HEIGHT}
                      />
                    </Container>
                  )}
                </field.Base>
              </field.Layout.Stack>
            )}
          </fields.Field>
        </Grid>

        <Stack gap="md" paddingTop="xl">
          <Text bold>{t('Example preview')}</Text>
          <PathMappingPreview
            stackRoot={normalizeRoot(stackRoot)}
            sourceRoot={normalizeRoot(sourceRoot)}
          />
          <PathMappingWarningAlert warning={warning} projectSlug={projectSlug} />
        </Stack>
      </Stack>
    </Container>
  );
}

export const PathMappingEdit = pathMappingFieldGroup.bindComponent(
  PathMappingEditImpl,
  'fields'
);
