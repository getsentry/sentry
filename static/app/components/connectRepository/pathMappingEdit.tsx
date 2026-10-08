import {Tag} from '@sentry/scraps/badge';
import {defineAppFieldGroup, useSelector} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow, IconBranch, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

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
import type {PathMappingWarning} from './warnings';

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
  warning?: PathMappingWarning;
};

function PathMappingEditImpl({
  fields,
  defaultBranch,
  hasCodeOwner,
  onDelete,
  projectSlug,
  providerKey,
  warning,
}: Props) {
  const {stackRoot, sourceRoot} = useSelector(fields.atom, values => values);
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
          <fields.Field
            name="stackRoot"
            listeners={[
              {
                run: ({value, fieldApi}) => fieldApi.handleChange(normalizeRoot(value)),
                triggers: ['blur'],
              },
            ]}
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
                  value={field.value}
                  onChange={field.handleChange}
                  placeholder={STACK_ROOT_PLACEHOLDER}
                  disabled={hasCodeOwner}
                />
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

          <fields.Field
            name="sourceRoot"
            listeners={[
              {
                run: ({value, fieldApi}) => fieldApi.handleChange(normalizeRoot(value)),
                triggers: ['blur'],
              },
            ]}
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
                hintText={t('What to replace it with, so the path points to your repo.')}
              >
                <field.Input
                  value={field.value}
                  onChange={field.handleChange}
                  placeholder={SOURCE_ROOT_PLACEHOLDER}
                  disabled={hasCodeOwner}
                />
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
