import type * as React from 'react';
import styled from '@emotion/styled';
import {z} from 'zod';

import {AutoSaveForm, defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {themeVariables} from '@sentry/scraps/theme';

import {t} from 'sentry/locale';
import {useUserOptionsMutationOptions} from 'sentry/utils/useMutateUserOptions';
import {useUser} from 'sentry/utils/useUser';

type ColorScheme = 'light' | 'dark';

const DEFAULT_VARIANT = 'default';

const themeVariantSchema = z.object({
  themeVariantDark: z.enum([DEFAULT_VARIANT, 'ash', 'midnight']),
});

type ThemeVariants = z.infer<typeof themeVariantSchema>;

type ThemeVariant<Value extends string> = {label: string; value: Value};

// Light has only the default theme, so there is no user option to save yet.
// Adding a light theme means adding a `themeVariantLight` option and saving it
// the way the dark section does.
const LIGHT_VARIANTS: Array<ThemeVariant<typeof DEFAULT_VARIANT>> = [
  {value: DEFAULT_VARIANT, label: t('Default')},
];

// Adding a dark theme is a new entry here and in the schema.

const DARK_VARIANTS: Array<ThemeVariant<ThemeVariants['themeVariantDark']>> = [
  {value: DEFAULT_VARIANT, label: t('Default')},
  {value: 'ash', label: t('Ash')},
  {value: 'midnight', label: t('Midnight')},
];

export function ThemeVariantPicker() {
  const user = useUser();
  const mutationOptions = useUserOptionsMutationOptions();

  return (
    <Stack gap="2xl" padding="xl">
      <LightThemeVariants />
      <AutoSaveForm
        name="themeVariantDark"
        schema={themeVariantSchema}
        initialValue={user.options.themeVariantDark ?? DEFAULT_VARIANT}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
            {({Card}) => (
              <field.Layout.Stack label={t('Dark')}>
                <ThemeVariantGrid>
                  {DARK_VARIANTS.map(variant => (
                    <Card key={variant.value} value={variant.value} padding="md">
                      <ThemeVariantCardContent scheme="dark" variant={variant} />
                    </Card>
                  ))}
                </ThemeVariantGrid>
              </field.Layout.Stack>
            )}
          </field.RadioGroup>
        )}
      </AutoSaveForm>
    </Stack>
  );
}

function LightThemeVariants() {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {variant: DEFAULT_VARIANT},
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="variant">
        {field => (
          <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
            {({Card}) => (
              <field.Layout.Stack label={t('Light')}>
                <ThemeVariantGrid>
                  {LIGHT_VARIANTS.map(variant => (
                    <Card key={variant.value} value={variant.value} padding="md">
                      <ThemeVariantCardContent scheme="light" variant={variant} />
                    </Card>
                  ))}
                </ThemeVariantGrid>
              </field.Layout.Stack>
            )}
          </field.RadioGroup>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

function ThemeVariantGrid({children}: {children: React.ReactNode}) {
  return (
    <Grid columns="repeat(auto-fill, minmax(180px, 1fr))" gap="lg">
      {children}
    </Grid>
  );
}

function ThemeVariantCardContent({
  scheme,
  variant,
}: {
  scheme: ColorScheme;
  variant: ThemeVariant<string>;
}) {
  return (
    <Stack gap="md">
      <ThemePreview scheme={scheme} variant={variant.value} />
      <Text>{variant.label}</Text>
    </Stack>
  );
}

function ThemePreview({scheme, variant}: {scheme: ColorScheme; variant: string}) {
  return (
    <PreviewRoot
      columns="24% 1fr"
      height="88px"
      overflow="hidden"
      radius="sm"
      aria-hidden
      data-test-id="theme-preview"
      data-color-scheme={scheme}
      // An explicit value for the default dark theme stops a dark theme set on
      // an ancestor from reaching the preview.
      data-theme-dark={scheme === 'dark' ? variant : undefined}
    >
      <PreviewSidebar />
      <Stack gap="sm" paddingBottom="sm">
        <PreviewHeader justify="end" align="center" height="20px" padding="0 sm">
          <PreviewAccent />
        </PreviewHeader>
        <PreviewRow />
        <PreviewRow short />
      </Stack>
    </PreviewRoot>
  );
}

// The preview reads CSS variables directly so that its data attributes, not
// the page's Emotion theme, decide the colors.
const {tokens} = themeVariables;

const PreviewRoot = styled(Grid)`
  border: 1px solid ${tokens.border.primary};
  background: ${tokens.background.primary};
`;

const PreviewSidebar = styled('div')`
  background: ${tokens.background.secondary};
  border-right: 1px solid ${tokens.border.primary};
`;

const PreviewHeader = styled(Flex)`
  border-bottom: 1px solid ${tokens.border.primary};
`;

const PreviewAccent = styled('div')`
  width: 24px;
  height: 8px;
  border-radius: ${p => p.theme.radius.full};
  background: ${tokens.background.accent.vibrant};
`;

const PreviewRow = styled('div')<{short?: boolean}>`
  height: 10px;
  width: ${p => (p.short ? '55%' : '80%')};
  margin: 0 ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.xs};
  background: ${tokens.background.tertiary};
`;
