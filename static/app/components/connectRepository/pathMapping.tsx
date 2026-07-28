import styled from '@emotion/styled';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InfoText} from '@sentry/scraps/info';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow, IconBranch, IconChevron, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface PathMappingValue {
  branch: string;
  sourceRoot: string;
  stackRoot: string;
}

interface PathMappingProps extends PathMappingValue {
  /**
   * When true, renders the editable form. Existing mappings keep their summary
   * pinned above the form; new mappings (see `isNew`) hide it.
   */
  editing: boolean;
  /**
   * Marks a not-yet-persisted mapping. New mappings hide the summary while
   * editing since there is nothing to collapse back to yet.
   */
  isNew: boolean;
  onChange: (value: PathMappingValue) => void;
  onDelete: () => void;
  onExpandToggle: () => void;
}

const DEFAULT_BRANCH = 'main';

/**
 * Normalizes branch input as the user types. Git branch names (see
 * `git check-ref-format`) allow slashes, underscores, dots and dashes, so we
 * preserve those and only replace genuinely invalid characters (whitespace,
 * `~^:?*[\` etc.) with a dash. Repeated slashes are collapsed and a leading
 * slash/dot — both invalid at the start of a ref — is stripped. Trailing
 * characters are left untouched here so a dash typed as a word separator
 * survives mid-typing; `resolveBranch` cleans up the committed value.
 */
const sanitizeBranch = (value: string) =>
  value
    .replace(/[^\w/.-]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^[./]+/, '');

/**
 * The effective branch for a mapping. A ref can't end with a slash or dot, so
 * those are trimmed, but a trailing dash is valid and kept. Falls back to the
 * default when empty. Used for the reported value and summary display.
 */
const resolveBranch = (branch: string) =>
  sanitizeBranch(branch).replace(/[./]+$/, '') || DEFAULT_BRANCH;

/**
 * Ensures a root reads as a path prefix that joins cleanly with the rest of a
 * file path (e.g. `app` -> `app/`, avoiding `appviews/index.tsx`).
 */
const withTrailingSlash = (root: string) => (root.endsWith('/') ? root : `${root}/`);

/**
 * Normalizes a path root: a non-empty root is given a trailing slash, while an
 * empty root is left empty since it matches every path.
 */
const normalizeRoot = (root: string) => (root === '' ? '' : withTrailingSlash(root));

const schema = z.object({
  stackRoot: z.string(),
  sourceRoot: z.string(),
  branch: z.string(),
});

/**
 * Canonical form of a mapping, used for the preview, duplicate detection, and
 * the on-blur normalization of the editable fields. Path roots are given a
 * trailing slash and the branch is resolved to its effective value (an empty
 * branch becomes `main`), so mappings that differ only by that normalization
 * parse to the same values.
 */
const normalizedPathMappingSchema = schema.extend({
  stackRoot: z.string().transform(normalizeRoot),
  sourceRoot: z.string().transform(normalizeRoot),
  branch: z.string().transform(resolveBranch),
});

/**
 * Sample stack frame path used to illustrate how the stack trace root is
 * rewritten to the source code root in the preview.
 */
const PREVIEW_SUFFIX = 'views/index.tsx';

/**
 * Flex-grow weights for how the summary row divides between the two paths and
 * the branch name when everything overflows (35% / 35% / 30%). `max-content`
 * caps on each item let unused space be reclaimed by the others.
 */
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
          <Grid columns="1fr 1fr" gap="xl">
            <form.AppField
              name="stackRoot"
              listeners={{
                onBlur: ({value}) =>
                  form.setFieldValue('stackRoot', normalizeRoot(value)),
              }}
            >
              {field => (
                <field.Layout.Stack
                  label={t('Stack trace prefix')}
                  variant="compact"
                  hintText={t(
                    'Any stack trace starting with this file prefix is mapped with this rule. An empty prefix matches any stack trace path.'
                  )}
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              )}
            </form.AppField>

            <form.AppField
              name="sourceRoot"
              listeners={{
                onBlur: ({value}) =>
                  form.setFieldValue('sourceRoot', normalizeRoot(value)),
              }}
            >
              {field => (
                <field.Layout.Stack
                  label={t('Source code replacement')}
                  variant="compact"
                  hintText={t(
                    'When a stack trace prefix matches, it is replaced with this path to resolve the file path in your repository. Leaving it empty replaces the prefix with an empty string.'
                  )}
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Grid>

          <form.AppField name="branch">
            {field => (
              <field.Layout.Stack
                label={t('Branch')}
                hintText={t('Which branch does this mapping apply to')}
              >
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

/**
 * The inner row of a mapping summary: the rewritten path, the branch, and the
 * expand/delete controls. Kept separate from the bordered box so it can also
 * be rendered as the header of the editing view.
 */
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

      {/* Absorbs leftover space so the branch + actions stay right-anchored
          when the paths don't overflow, and collapses when they do. */}
      <Container flex="1 0 0%" />

      <Flex
        align="center"
        gap="xs"
        flex={`${BRANCH_RATIO} 0 0%`}
        minWidth={0}
        maxWidth="max-content"
      >
        <Container flexShrink={0}>{props => <IconBranch {...props} />}</Container>
        <InfoText title={branchName} mode="overflowOnly" variant="muted">
          {branchName}
        </InfoText>
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

/**
 * A single path in the summary. Grows to its share of the row but never past
 * its own content (`max-content`), so a short path yields its space to the
 * others. Truncates with an overflow tooltip when it does fill its share.
 */
function PathSegment({value}: {value: string}) {
  return (
    <Flex flex={`${PATH_RATIO} 0 0%`} minWidth={0} maxWidth="max-content">
      {value ? (
        <AccentPathSegment value={value} ellipsis />
      ) : (
        <Text monospace variant="muted">
          {t('[empty]')}
        </Text>
      )}
    </Flex>
  );
}

const AccentHighlight = styled(Container)`
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;

interface AccentPathSegmentProps {
  value: string;
  ellipsis?: boolean;
}

/**
 * An accent-colored path with the highlighted background that hugs the text.
 * The background comes from a `Container` whose className is spread onto the
 * `Text` (the accent token isn't expressible through `Container`'s `background`
 * prop, so it lives on the styled wrapper). Pass `ellipsis` where the row can
 * truncate; it switches to `inline-block` and adds an overflow tooltip.
 */
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
