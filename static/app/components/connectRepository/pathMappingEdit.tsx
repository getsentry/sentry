import {Tag} from '@sentry/scraps/badge';
import {withFieldGroup} from '@sentry/scraps/form';
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
import {PathMappingPreview} from './pathMappingPreview';
import {PathMappingWarningAlert} from './pathMappingWarningAlert';
import type {PathMappingWarning} from './warnings';

export const PathMappingEdit = withFieldGroup({
  defaultValues: {stackRoot: '', sourceRoot: '', branch: ''},
  props: {} as {
    defaultBranch?: string;
    hasCodeOwner?: boolean;
    projectSlug?: string;
    providerKey?: string;
    warning?: PathMappingWarning | null;
  },
  render: ({group, defaultBranch, hasCodeOwner, projectSlug, providerKey, warning}) => {
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
              <field.Layout.Stack label={t('Branch')}>
                <field.Input
                  value={field.state.value}
                  onChange={(value: string) => field.handleChange(sanitizeBranch(value))}
                  placeholder={branchFallback}
                  leadingItems={<IconBranch />}
                />
              </field.Layout.Stack>
            )}
          </group.AppField>

          <Grid columns={{zero: '1fr', '2xs': '1fr auto 1fr'}} gap="xl">
            <group.AppField
              name="stackRoot"
              listeners={{
                onBlur: ({value}) =>
                  group.setFieldValue('stackRoot', normalizeRoot(value)),
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
            <Text bold>{t('Preview')}</Text>
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
