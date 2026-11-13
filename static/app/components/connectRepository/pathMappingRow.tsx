import {IconArrow} from '@sentry/icons/arrow';
import {IconBranch} from '@sentry/icons/branch';
import {IconCode} from '@sentry/icons/code';
import {IconSentry} from '@sentry/icons/sentry';
import {useQuery} from '@tanstack/react-query';

import {withFieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AutomaticTag} from './automaticTag';
import {SOURCE_ROOT_PLACEHOLDER, STACK_ROOT_PLACEHOLDER} from './constants';
import {
  DEFAULT_BRANCH,
  normalizeRoot,
  resolveBranch,
  sanitizeBranch,
} from './normalization';
import {PathMappingDeleteButton} from './pathMappingDeleteButton';
import {PathMappingWarningAlert} from './pathMappingWarningAlert';
import {PathPrefixCombobox} from './pathPrefixCombobox';
import {repoCodeMappingPrefixesOptions, stackCodeMappingPrefixesOptions} from './queries';
import type {PathMappingWarning} from './warnings';

const PREFIX_MENU_MAX_HEIGHT = 250;
const PREVIEW_SUFFIX = 'views/index.tsx';

/**
 * Columns shared by the table header and every row so they line up:
 * stack trace prefix, arrow, repository prefix, branch, delete.
 * Below the `sm` container breakpoint each row stacks instead.
 */
export const PATH_MAPPING_COLUMNS = {
  zero: '1fr',
  sm: 'minmax(0, 3fr) auto minmax(0, 3fr) minmax(0, 2fr) auto',
} as const;

/** Stops before the delete column, so banners line up with the inputs. */
const BELOW_INPUTS_COLUMN = {zero: '1 / -1', sm: '1 / 5'} as const;

// One side of the example: where the path comes from (Sentry or the SCM),
// then the prefix in accent bold running straight into the file suffix. The
// inner span is inline, so turn off trimming to keep it on the same baseline.
function PreviewPath({icon, root}: {icon: React.ReactNode; root: string}) {
  return (
    <Flex align="center" gap="xs" flexShrink={0}>
      <Flex flexShrink={0}>{icon}</Flex>
      <Text wrap="nowrap">
        {root && (
          <Text as="span" variant="accent" bold trim={false}>
            {root}
          </Text>
        )}
        {PREVIEW_SUFFIX}
      </Text>
    </Flex>
  );
}

/**
 * One line, e.g. "e.g (Sentry) src/views/index.tsx → (SCM) app/views/index.tsx",
 * with each prefix in accent bold. Clipped when the row is narrow.
 */
function PathMappingExample({
  stackRoot,
  sourceRoot,
  providerKey,
}: {
  sourceRoot: string;
  stackRoot: string;
  providerKey?: string;
}) {
  return (
    <Flex align="center" gap="sm" minWidth={0} overflow="hidden">
      <Container flexShrink={0}>
        <Text wrap="nowrap">{t('e.g')}</Text>
      </Container>
      <PreviewPath root={stackRoot} icon={<IconSentry size="xs" />} />
      <Container flexShrink={0}>
        {props => <IconArrow direction="right" size="xs" variant="muted" {...props} />}
      </Container>
      <PreviewPath
        root={sourceRoot}
        icon={
          providerKey ? getIntegrationIcon(providerKey, 'xs') : <IconCode size="xs" />
        }
      />
    </Flex>
  );
}

export const PathMappingRow = withFieldGroup({
  defaultValues: {stackRoot: '', sourceRoot: '', branch: ''},
  props: {} as {
    onDelete: () => void;
    automaticallyGenerated?: boolean;
    defaultBranch?: string;
    hasCodeOwner?: boolean;
    projectSlug?: string;
    /** SCM provider, for the logo in the example path. */
    providerKey?: string;
    repositoryId?: string;
    warning?: PathMappingWarning;
  },
  render: function PathMappingRowRender({
    group,
    automaticallyGenerated,
    defaultBranch,
    hasCodeOwner,
    onDelete,
    projectSlug,
    providerKey,
    repositoryId,
    warning,
  }) {
    const organization = useOrganization();
    const stackPrefixes = useQuery(
      stackCodeMappingPrefixesOptions({orgSlug: organization.slug, projectSlug})
    );
    const repoPrefixes = useQuery(
      repoCodeMappingPrefixesOptions({orgSlug: organization.slug, repositoryId})
    );

    const branchFallback = defaultBranch ?? DEFAULT_BRANCH;

    return (
      <Stack gap="md" padding="lg" borderTop="muted">
        <Grid columns={PATH_MAPPING_COLUMNS} gap="lg" align="center">
          <group.AppField name="stackRoot">
            {field => (
              <field.Base<HTMLInputElement> disabled={hasCodeOwner}>
                {({ref: _ref, ...baseProps}) => (
                  <Container flex={1} minWidth={0}>
                    <PathPrefixCombobox
                      {...baseProps}
                      aria-label={t('Stack trace prefix')}
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={stackPrefixes.data?.prefixes ?? []}
                      isLoading={stackPrefixes.isLoading}
                      placeholder={STACK_ROOT_PLACEHOLDER}
                      size="sm"
                      maxMenuHeight={PREFIX_MENU_MAX_HEIGHT}
                    />
                  </Container>
                )}
              </field.Base>
            )}
          </group.AppField>

          <Flex justify="center" display={{zero: 'none', sm: 'flex'}}>
            <IconArrow direction="right" size="sm" variant="muted" />
          </Flex>

          <group.AppField name="sourceRoot">
            {field => (
              <field.Base<HTMLInputElement> disabled={hasCodeOwner}>
                {({ref: _ref, ...baseProps}) => (
                  <Container flex={1} minWidth={0}>
                    <PathPrefixCombobox
                      {...baseProps}
                      aria-label={t('Repository prefix')}
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={repoPrefixes.data?.prefixes ?? []}
                      isLoading={repoPrefixes.isLoading}
                      placeholder={SOURCE_ROOT_PLACEHOLDER}
                      size="sm"
                      maxMenuHeight={PREFIX_MENU_MAX_HEIGHT}
                    />
                  </Container>
                )}
              </field.Base>
            )}
          </group.AppField>

          <group.AppField
            name="branch"
            listeners={{
              onBlur: ({value}) =>
                group.setFieldValue('branch', resolveBranch(value, branchFallback)),
            }}
          >
            {field => (
              <field.Input
                size="sm"
                aria-label={t('Branch')}
                value={field.state.value}
                onChange={(value: string) => field.handleChange(sanitizeBranch(value))}
                placeholder={branchFallback}
                leadingItems={<IconBranch />}
              />
            )}
          </group.AppField>

          <Flex justify="end">
            <PathMappingDeleteButton
              hasCodeOwner={hasCodeOwner}
              onDelete={onDelete}
              projectSlug={projectSlug}
            />
          </Flex>
        </Grid>

        {/* Same columns as the inputs, so the example and any banner end at
            the branch field and leave the delete column clear. */}
        <Grid columns={PATH_MAPPING_COLUMNS} gap="lg">
          <group.Subscribe
            selector={state => ({
              stackRoot: state.values?.stackRoot ?? '',
              sourceRoot: state.values?.sourceRoot ?? '',
            })}
          >
            {({stackRoot, sourceRoot}) => (
              // Inset by the sm input's 12px padding so the example lines up
              // with the text inside the inputs above it.
              <Flex
                column={BELOW_INPUTS_COLUMN}
                align="center"
                gap="md"
                paddingLeft="lg"
                minWidth={0}
              >
                <Container flex={1} minWidth={0}>
                  <PathMappingExample
                    stackRoot={normalizeRoot(stackRoot)}
                    sourceRoot={normalizeRoot(sourceRoot)}
                    providerKey={providerKey}
                  />
                </Container>
                {automaticallyGenerated && (
                  <Container flexShrink={0}>
                    <AutomaticTag />
                  </Container>
                )}
              </Flex>
            )}
          </group.Subscribe>

          {warning && (
            <Container column={BELOW_INPUTS_COLUMN} minWidth={0}>
              <PathMappingWarningAlert warning={warning} projectSlug={projectSlug} />
            </Container>
          )}
        </Grid>
      </Stack>
    );
  },
});
