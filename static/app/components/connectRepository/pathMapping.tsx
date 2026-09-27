import styled from '@emotion/styled';
import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow, IconBranch, IconChevron, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

import {
  DEFAULT_BRANCH,
  normalizedPathMappingSchema,
  normalizeRoot,
  resolveBranch,
  sanitizeBranch,
} from './normalization';
import type {PathMappingValue} from './type';

interface PathMappingProps extends PathMappingValue {
  /**
   * When true, renders the editable form. Existing mappings keep their summary
   * pinned above the form; new mappings (isNew) hide it since there is nothing
   * to collapse back to yet.
   */
  editing: boolean;
  isNew: boolean;
  onChange: (value: PathMappingValue) => void;
  onDelete: () => void;
  onExpandToggle: () => void;
}

// Non-transforming schema used only for the form's onDynamic validator.
const schema = z.object({
  stackRoot: z.string(),
  sourceRoot: z.string(),
  branch: z.string(),
});

const PREVIEW_SUFFIX = 'views/index.tsx';

const PATH_RATIO = 35;
const BRANCH_RATIO = 30;

export function PathMapping({
  editing,
  isNew,
  onChange,
  onDelete,
  onExpandToggle,
  ...value
}: PathMappingProps) {
  const showSummary = !(editing && isNew);

  return (
    <Stack border="muted" radius="md">
      {showSummary && (
        <PathMappingSummary
          {...value}
          expanded={editing}
          onDelete={onDelete}
          onExpandToggle={onExpandToggle}
        />
      )}
      {showSummary && editing && <Container borderTop="muted" />}
      {editing && <PathMappingEdit {...value} onChange={onChange} />}
    </Stack>
  );
}

interface PathMappingEditProps extends PathMappingValue {
  onChange: (value: PathMappingValue) => void;
}

function PathMappingEdit({
  branch,
  sourceRoot,
  stackRoot,
  onChange,
}: PathMappingEditProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {stackRoot, sourceRoot, branch},
    validators: {onDynamic: schema},
    listeners: {
      onChange: ({formApi}) => {
        const values = formApi.state.values;
        onChange({...values, branch: resolveBranch(values.branch)});
      },
    },
    onSubmit: () => {},
  });

  return (
    <form.AppForm form={form}>
      <Container padding="xl">
        <Stack gap="xl">
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
                        placeholder={DEFAULT_BRANCH}
                        onChange={e => field.handleChange(sanitizeBranch(e.target.value))}
                      />
                      <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
                    </InputGroup>
                  )}
                </field.Base>
              </field.Layout.Stack>
            )}
          </form.AppField>

          <Grid columns="1fr auto 1fr" gap="xl" align="center">
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
                      {t('Stack trace prefix')}
                      <Tag variant="muted">{t('Match')}</Tag>
                    </Flex>
                  }
                  hintText={t('The start of the paths in your stack traces.')}
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              )}
            </form.AppField>

            <IconArrow direction="right" size="sm" />

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
                      {t('Repository prefix')}
                      <Tag variant="muted">{t('Replace with')}</Tag>
                    </Flex>
                  }
                  hintText={t(
                    'What to replace it with, so the path points to your repo.'
                  )}
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Grid>

          <Stack gap="md">
            <Text bold>{t('Preview example')}</Text>
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
          </Stack>
        </Stack>
      </Container>
    </form.AppForm>
  );
}

interface SummaryContentProps extends PathMappingValue {
  expanded: boolean;
  onDelete: () => void;
  onExpandToggle: () => void;
}

function SummaryContent({
  branch,
  sourceRoot,
  stackRoot,
  expanded,
  onDelete,
  onExpandToggle,
}: SummaryContentProps) {
  const {
    stackRoot: normalizedStackRoot,
    sourceRoot: normalizedSourceRoot,
    branch: branchName,
  } = normalizedPathMappingSchema.parse({stackRoot, sourceRoot, branch});

  return (
    <Flex align="center" gap="md" minWidth={0}>
      <PathSegment value={normalizedStackRoot} />
      <Container flexShrink={0}>
        {props => <IconArrow direction="right" size="xs" {...props} />}
      </Container>
      <PathSegment value={normalizedSourceRoot} />

      <Container flex="1 0 0%" />

      <Flex
        align="center"
        gap="xs"
        flex={`${BRANCH_RATIO} 0 0%`}
        minWidth={0}
        maxWidth="max-content"
      >
        <Container flexShrink={0}>{props => <IconBranch {...props} />}</Container>
        {/* eslint-disable-next-line @sentry/scraps/prefer-info-text -- InfoText has no showOnlyOnOverflow support */}
        <Tooltip title={branchName} showOnlyOnOverflow skipWrapper>
          <Text variant="muted" ellipsis>
            {branchName}
          </Text>
        </Tooltip>
      </Flex>

      <Flex align="center" gap="xs" flexShrink={0}>
        <Button
          size="zero"
          variant="transparent"
          icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
          aria-label={expanded ? t('Collapse path mapping') : t('Expand path mapping')}
          onClick={onExpandToggle}
        />
        <Button
          size="zero"
          variant="transparent"
          icon={<IconDelete />}
          aria-label={t('Delete path mapping')}
          onClick={onDelete}
        />
      </Flex>
    </Flex>
  );
}

function PathMappingSummary(props: SummaryContentProps) {
  return (
    <Container padding="md xl">
      <SummaryContent {...props} />
    </Container>
  );
}

function PathSegment({value}: {value: string}) {
  return (
    <Flex flex={`${PATH_RATIO} 0 0%`} minWidth={0} maxWidth="max-content">
      {value ? (
        <AccentPathSegment value={value} ellipsis />
      ) : (
        <Text monospace variant="muted">
          {t('empty')}
        </Text>
      )}
    </Flex>
  );
}

// The accent token is not available as a Container `background` value, so it
// lives on a styled wrapper.
const AccentHighlight = styled(Container)`
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;

interface AccentPathSegmentProps {
  value: string;
  ellipsis?: boolean;
}

function AccentPathSegment({value, ellipsis}: AccentPathSegmentProps) {
  return (
    <AccentHighlight
      display={ellipsis ? 'inline-block' : 'inline'}
      radius="xs"
      padding="0 xs"
      maxWidth={ellipsis ? '100%' : undefined}
    >
      {props => {
        const text = (
          <Text {...props} monospace variant="accent" ellipsis={ellipsis || undefined}>
            {value}
          </Text>
        );

        return ellipsis ? (
          <Tooltip title={value} showOnlyOnOverflow skipWrapper>
            {text}
          </Tooltip>
        ) : (
          text
        );
      }}
    </AccentHighlight>
  );
}

interface PathMappingPreviewProps {
  sourceRoot: string;
  stackRoot: string;
}

function PathMappingPreview({stackRoot, sourceRoot}: PathMappingPreviewProps) {
  return (
    <Container background="secondary" radius="md" padding="xl">
      <Grid columns="1fr auto 1fr" gap="lg xl" align="center">
        <Text bold variant="muted">
          {t('In your stack trace')}
        </Text>
        <span />
        <Text bold variant="muted">
          {t('Sentry opens in your repo')}
        </Text>

        <Text monospace variant="muted">
          {stackRoot && <AccentPathSegment value={stackRoot} />}
          {PREVIEW_SUFFIX}
        </Text>
        <IconArrow direction="right" />
        <Text monospace variant="muted">
          {sourceRoot && <AccentPathSegment value={sourceRoot} />}
          {PREVIEW_SUFFIX}
        </Text>
      </Grid>
    </Container>
  );
}
