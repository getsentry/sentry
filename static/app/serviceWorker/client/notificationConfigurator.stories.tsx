import {useCallback, useMemo, useRef, useState} from 'react';
import {z} from 'zod';

import sentryLogo from 'sentry-images/logo.png';
import sentryAvatar from 'sentry-images/sentry-avatar.png';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {IconList} from 'sentry/icons';
import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import {useNotificationPermission} from 'sentry/serviceWorker/client/useNotificationPermission';
import type {RequestMessage, AllNotificationOptions} from 'sentry/serviceWorker/types';
import * as Storybook from 'sentry/stories';
import type {AvatarProject} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

export default Storybook.story('ServiceWorker', story => {
  story('Notification Configurator', () => <NotificationConfigurator />);
});

// Realistic example values so the payload can be assembled quickly without
// typing everything by hand.
const TITLE_EXAMPLES = [
  'Test Notification',
  'New issue detected',
  'Deploy to production succeeded',
  'Your trial ends in 3 days',
  'Error rate spike in checkout',
];
const BODY_EXAMPLES = [
  'You will now receive notifications from Sentry',
  'A new error was seen in your project. Click to view details.',
  'The error rate for /checkout increased 300% in the last hour.',
  '3 new issues were assigned to you.',
  'Your deploy finished in 42s with 0 new issues.',
];
const TAG_EXAMPLES = ['sentry-notification', 'issue-alert', 'deploy', 'weekly-report'];
const DATA_TYPE_EXAMPLES = ['sentry-notification', 'issue-alert', 'deploy-notification'];
const URL_EXAMPLES = [
  'https://sentry.io',
  'https://sentry.io/issues/',
  'https://sentry.io/settings/notifications/',
];
const LANG_EXAMPLES = ['en-US', 'en-GB', 'de-DE', 'ja-JP'];

const IMAGE_SOURCE_VALUES = [
  'none',
  'sentry-favicon',
  'sentry-logo',
  'sentry-avatar',
  'org-avatar',
  'project-avatar',
  'custom',
] as const;
type ImageSource = (typeof IMAGE_SOURCE_VALUES)[number];
type FixedImageSource = Exclude<ImageSource, 'none' | 'custom'>;

type TriState = 'omit' | 'true' | 'false';
type DirValue = 'omit' | NotificationDirection;

const TRISTATE_OPTIONS = [
  {value: 'omit', label: 'Omit'},
  {value: 'true', label: 'true'},
  {value: 'false', label: 'false'},
] satisfies Array<{label: string; value: TriState}>;

const DIR_OPTIONS = [
  {value: 'omit', label: 'Omit'},
  {value: 'auto', label: 'auto'},
  {value: 'ltr', label: 'ltr'},
  {value: 'rtl', label: 'rtl'},
] satisfies Array<{label: string; value: DirValue}>;

const isValidUrl = (value: string) => URL.canParse(value);

const notificationSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    body: z.string(),
    tag: z.string(),
    lang: z.string(),
    dataType: z.string(),
    dataUrl: z.string(),
    iconSource: z.enum(IMAGE_SOURCE_VALUES),
    iconCustom: z.string(),
    badgeSource: z.enum(IMAGE_SOURCE_VALUES),
    badgeCustom: z.string(),
    imageSource: z.enum(IMAGE_SOURCE_VALUES),
    imageCustom: z.string(),
    dir: z.enum(['omit', 'auto', 'ltr', 'rtl']),
    requireInteraction: z.enum(['omit', 'true', 'false']),
    renotify: z.enum(['omit', 'true', 'false']),
    silent: z.enum(['omit', 'true', 'false']),
  })
  .superRefine((values, ctx) => {
    const customFields = [
      ['iconSource', 'iconCustom'],
      ['badgeSource', 'badgeCustom'],
      ['imageSource', 'imageCustom'],
    ] as const;
    for (const [sourceKey, customKey] of customFields) {
      if (
        values[sourceKey] === 'custom' &&
        values[customKey] &&
        !isValidUrl(values[customKey])
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [customKey],
          message: 'Enter a valid URL',
        });
      }
    }
    if (values.dataUrl && !isValidUrl(values.dataUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataUrl'],
        message: 'Enter a valid URL',
      });
    }
  });

type NotificationFormValues = z.infer<typeof notificationSchema>;

const DEFAULT_VALUES: NotificationFormValues = {
  title: 'Test Notification',
  body: 'You will now receive notifications from Sentry',
  tag: '',
  lang: '',
  dataType: 'sentry-notification',
  dataUrl: 'https://sentry.io',
  iconSource: 'sentry-favicon',
  iconCustom: '',
  badgeSource: 'none',
  badgeCustom: '',
  imageSource: 'none',
  imageCustom: '',
  dir: 'omit',
  requireInteraction: 'omit',
  renotify: 'omit',
  silent: 'omit',
};

/**
 * Notification icons are resolved by the OS/browser, so relative asset URLs
 * (e.g. webpack image imports) need to be made absolute to render reliably.
 */
function toAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

function resolveImageUrl(
  source: ImageSource,
  custom: string,
  imageSources: Record<FixedImageSource, string | null>
): string | undefined {
  if (source === 'none') {
    return undefined;
  }
  if (source === 'custom') {
    return custom.trim() || undefined;
  }
  return imageSources[source] ?? undefined;
}

function buildPayload(
  values: NotificationFormValues,
  imageSources: Record<FixedImageSource, string | null>
): RequestMessage {
  const options: AllNotificationOptions = {};

  if (values.body.trim()) {
    options.body = values.body;
  }
  const iconUrl = resolveImageUrl(values.iconSource, values.iconCustom, imageSources);
  if (iconUrl) {
    options.icon = iconUrl;
  }
  const badgeUrl = resolveImageUrl(values.badgeSource, values.badgeCustom, imageSources);
  if (badgeUrl) {
    options.badge = badgeUrl;
  }
  const imageUrl = resolveImageUrl(values.imageSource, values.imageCustom, imageSources);
  if (imageUrl) {
    options.image = imageUrl;
  }
  if (values.tag.trim()) {
    options.tag = values.tag;
  }
  if (values.dir !== 'omit') {
    options.dir = values.dir;
  }
  if (values.lang.trim()) {
    options.lang = values.lang;
  }
  if (values.requireInteraction !== 'omit') {
    options.requireInteraction = values.requireInteraction === 'true';
  }
  if (values.renotify !== 'omit') {
    options.renotify = values.renotify === 'true';
  }
  if (values.silent !== 'omit') {
    options.silent = values.silent === 'true';
  }

  const data: Record<string, string> = {};
  if (values.dataType.trim()) {
    data.type = values.dataType;
  }
  if (values.dataUrl.trim()) {
    data.url = values.dataUrl;
  }
  if (Object.keys(data).length > 0) {
    options.data = data;
  }

  return {
    name: 'trigger.test-notification',
    type: 'request',
    timeoutMs: 1_000,
    data: {title: values.title, options},
  };
}

function NotificationConfigurator() {
  const {controller} = useServiceWorker();
  const organization = useOrganization();
  const {projects} = useProjects();
  const {permission, supportsNotifications, askNotificationPermission} =
    useNotificationPermission();

  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const project = useMemo(
    () => projects.find(p => p.slug === projectSlug) ?? projects[0],
    [projects, projectSlug]
  );

  // The project "avatar" is a platform icon rendered as an <img>, so we probe
  // the rendered element to recover a URL usable in the notification payload.
  const [projectIconUrl, setProjectIconUrl] = useState<string | null>(null);
  const [responses, setResponses] = useState<unknown[]>([]);

  const imageSources = useMemo<Record<FixedImageSource, string | null>>(
    () => ({
      'sentry-favicon': 'https://sentry.io/favicon.ico',
      'sentry-logo': toAbsoluteUrl(sentryLogo),
      'sentry-avatar': toAbsoluteUrl(sentryAvatar),
      'org-avatar': toAbsoluteUrl(organization.avatar?.avatarUrl),
      'project-avatar': projectIconUrl,
    }),
    [organization.avatar?.avatarUrl, projectIconUrl]
  );

  // onSubmit closes over the form once, so read the latest sources via a ref.
  const imageSourcesRef = useRef(imageSources);
  imageSourcesRef.current = imageSources;

  const imageSourceOptions = useMemo(
    (): Array<{label: string; value: ImageSource; disabled?: boolean}> => [
      {value: 'none', label: 'None (omit)'},
      {value: 'sentry-favicon', label: 'Sentry favicon'},
      {value: 'sentry-logo', label: 'Sentry logo'},
      {value: 'sentry-avatar', label: 'Sentry avatar'},
      {
        value: 'org-avatar',
        label: `Org avatar (${organization.slug})`,
        disabled: !imageSources['org-avatar'],
      },
      {
        value: 'project-avatar',
        label: project ? `Project avatar (${project.slug})` : 'Project avatar',
        disabled: !imageSources['project-avatar'],
      },
      {value: 'custom', label: 'Custom URL…'},
    ],
    [organization.slug, project, imageSources]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: DEFAULT_VALUES,
    validators: {onDynamic: notificationSchema},
    onSubmit: async ({value}) => {
      const message = buildPayload(value, imageSourcesRef.current);
      try {
        const result = await controller.postMessage(message);
        setResponses(prev => [result, ...prev]);
      } catch (error) {
        setResponses(prev => [error, ...prev]);
      }
    },
  });

  const permissionGranted = permission === 'granted';

  const renderImageField = (
    sourceName: 'iconSource' | 'badgeSource' | 'imageSource',
    customName: 'iconCustom' | 'badgeCustom' | 'imageCustom',
    label: string,
    hintText: string
  ) => (
    <form.AppField name={sourceName}>
      {field => (
        <field.Layout.Row label={label} hintText={hintText}>
          <Flex gap="md" align="center" wrap="wrap" flex={1}>
            <field.Select
              value={field.state.value}
              onChange={field.handleChange}
              options={imageSourceOptions}
            />
            <form.Subscribe selector={state => state.values[sourceName] === 'custom'}>
              {isCustom =>
                isCustom ? (
                  <form.AppField name={customName}>
                    {customField => (
                      <customField.Input
                        value={customField.state.value}
                        onChange={customField.handleChange}
                        placeholder="https://example.com/image.png"
                      />
                    )}
                  </form.AppField>
                ) : null
              }
            </form.Subscribe>
            <form.Subscribe
              selector={state =>
                resolveImageUrl(
                  state.values[sourceName],
                  state.values[customName],
                  imageSources
                ) ?? ''
              }
            >
              {url => <ImagePreview url={url || undefined} />}
            </form.Subscribe>
          </Flex>
        </field.Layout.Row>
      )}
    </form.AppField>
  );

  return (
    <Stack gap="xl">
      <ImgSrcProbe project={project} onResolve={setProjectIconUrl} />

      <Flex gap="md" align="center" wrap="wrap">
        <Text variant={permissionGranted ? 'success' : 'warning'}>
          Notification permission: {supportsNotifications ? permission : 'unsupported'}
        </Text>
        {supportsNotifications && !permissionGranted ? (
          <Button size="xs" onClick={() => askNotificationPermission()}>
            Request permission
          </Button>
        ) : null}
        <Storybook.SelectProject
          projectSlug={project?.slug}
          setProjectSlug={setProjectSlug}
        />
      </Flex>

      <form.AppForm form={form}>
        <form.FieldGroup title="Notification">
          <form.AppField name="title">
            {field => (
              <field.Layout.Row
                label="title"
                hintText="Required. The notification heading."
                required
              >
                <Flex gap="sm" align="center" wrap="wrap" flex={1}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                  <PresetMenu examples={TITLE_EXAMPLES} onPick={field.handleChange} />
                </Flex>
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="body">
            {field => (
              <field.Layout.Row label="body" hintText="Main text. Leave blank to omit.">
                <Flex gap="sm" align="center" wrap="wrap" flex={1}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                  <PresetMenu examples={BODY_EXAMPLES} onPick={field.handleChange} />
                </Flex>
              </field.Layout.Row>
            )}
          </form.AppField>

          {renderImageField(
            'iconSource',
            'iconCustom',
            'icon',
            'Small icon shown next to the text.'
          )}
          {renderImageField(
            'badgeSource',
            'badgeCustom',
            'badge',
            'Monochrome status-bar icon (mobile).'
          )}
          {renderImageField(
            'imageSource',
            'imageCustom',
            'image',
            'Large hero image (Chrome).'
          )}

          <form.AppField name="tag">
            {field => (
              <field.Layout.Row
                label="tag"
                hintText="Notifications sharing a tag replace each other. Leave blank to omit."
              >
                <Flex gap="sm" align="center" wrap="wrap" flex={1}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                  <PresetMenu examples={TAG_EXAMPLES} onPick={field.handleChange} />
                </Flex>
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="dir">
            {field => (
              <field.Layout.Row label="dir" hintText="Text direction.">
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={DIR_OPTIONS}
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="lang">
            {field => (
              <field.Layout.Row
                label="lang"
                hintText="BCP 47 language tag. Leave blank to omit."
              >
                <Flex gap="sm" align="center" wrap="wrap" flex={1}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                  <PresetMenu examples={LANG_EXAMPLES} onPick={field.handleChange} />
                </Flex>
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="requireInteraction">
            {field => (
              <field.Layout.Row
                label="requireInteraction"
                hintText="Keep the notification visible until dismissed."
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={TRISTATE_OPTIONS}
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="renotify">
            {field => (
              <field.Layout.Row
                label="renotify"
                hintText="Re-alert when replacing a notification (requires tag)."
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={TRISTATE_OPTIONS}
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="silent">
            {field => (
              <field.Layout.Row label="silent" hintText="Suppress sound and vibration.">
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={TRISTATE_OPTIONS}
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="dataType">
            {field => (
              <field.Layout.Row
                label="data.type"
                hintText="Custom payload for the click handler. Leave blank to omit."
              >
                <Flex gap="sm" align="center" wrap="wrap" flex={1}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                  <PresetMenu examples={DATA_TYPE_EXAMPLES} onPick={field.handleChange} />
                </Flex>
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="dataUrl">
            {field => (
              <field.Layout.Row
                label="data.url"
                hintText="URL to open when clicked. Leave blank to omit."
              >
                <Flex gap="sm" align="center" wrap="wrap" flex={1}>
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                  <PresetMenu examples={URL_EXAMPLES} onPick={field.handleChange} />
                </Flex>
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        <Flex gap="md" align="center">
          <form.SubmitButton disabled={!permissionGranted}>
            Send Notification
          </form.SubmitButton>
          <form.ResetButton>Reset</form.ResetButton>
          {responses.length > 0 ? (
            <Button size="sm" onClick={() => setResponses([])}>
              Clear responses
            </Button>
          ) : null}
        </Flex>
      </form.AppForm>

      <Grid columns={{xs: '1fr', md: '1fr 1fr'}} gap="lg">
        <Stack gap="xs">
          <Text bold>Payload</Text>
          <form.Subscribe selector={state => state.values}>
            {values => (
              <CodeBlock>
                {JSON.stringify(buildPayload(values, imageSources), null, 2)}
              </CodeBlock>
            )}
          </form.Subscribe>
        </Stack>
        <Stack gap="xs">
          <Text bold>Responses</Text>
          <CodeBlock>{JSON.stringify(responses, null, 2)}</CodeBlock>
        </Stack>
      </Grid>
    </Stack>
  );
}

function PresetMenu({
  examples,
  onPick,
}: {
  examples: readonly string[];
  onPick: (value: string) => void;
}) {
  return (
    <CompactSelect
      size="sm"
      value={undefined}
      options={examples.map(value => ({value, label: value}))}
      onChange={opt => onPick(opt.value)}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="sm"
          aria-label="Insert a preset value"
          icon={<IconList />}
        />
      )}
    />
  );
}

function ImagePreview({url}: {url: string | undefined}) {
  if (!url) {
    return (
      <Text size="sm" variant="muted">
        No image
      </Text>
    );
  }
  return (
    <img
      src={url}
      alt="notification image preview"
      height={28}
      style={{maxWidth: 120, borderRadius: 4, objectFit: 'contain'}}
    />
  );
}

/**
 * Renders a project avatar (a platform icon) offscreen and reports the
 * underlying image URL so it can be reused as a notification image source.
 */
function ImgSrcProbe({
  project,
  onResolve,
}: {
  onResolve: (url: string | null) => void;
  project: AvatarProject | undefined;
}) {
  const ref = useCallback(
    (node: HTMLSpanElement | null) => {
      const img = node?.querySelector('img');
      onResolve(img?.src ?? null);
    },
    [onResolve]
  );

  if (!project) {
    return null;
  }

  return (
    <span
      key={project.slug}
      ref={ref}
      aria-hidden
      style={{position: 'absolute', width: 0, height: 0, overflow: 'hidden'}}
    >
      <ProjectAvatar project={project} size={64} />
    </span>
  );
}

function CodeBlock({children}: {children: React.ReactNode}) {
  return (
    <Container
      background="secondary"
      border="primary"
      radius="md"
      padding="md"
      overflow="auto"
      maxHeight="320px"
    >
      <Text as="p" monospace size="sm" wrap="pre">
        {children}
      </Text>
    </Container>
  );
}
