import {useId, useState} from 'react';
import styled from '@emotion/styled';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {themeVariables} from '@sentry/scraps/theme';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {t} from 'sentry/locale';

type ColorScheme = 'light' | 'dark';

type ThemeVariant = {
  label: string;
  value: string;
};

type ThemeVariantSection = {
  scheme: ColorScheme;
  title: string;
  variants: ThemeVariant[];
};

const DEFAULT_VARIANT = 'default';

// Each section is one radio group. Adding a theme is a new entry in `variants`.
const THEME_VARIANT_SECTIONS: ThemeVariantSection[] = [
  {
    scheme: 'light',
    title: t('Light'),
    variants: [{value: DEFAULT_VARIANT, label: t('Default')}],
  },
  {
    scheme: 'dark',
    title: t('Dark'),
    variants: [
      {value: DEFAULT_VARIANT, label: t('Default')},
      {value: 'ash', label: t('Ash')},
      {value: 'midnight', label: t('Midnight')},
    ],
  },
];

type SelectedVariants = Record<ColorScheme, string>;

/**
 * Holds the selected theme per color scheme. Selections only live in component
 * state for now: persistence plugs in here once we decide where to store it.
 */
function useThemeVariants() {
  const [selected, setSelected] = useState<SelectedVariants>({
    light: DEFAULT_VARIANT,
    dark: DEFAULT_VARIANT,
  });

  const selectVariant = (scheme: ColorScheme, value: string) =>
    setSelected(previous => ({...previous, [scheme]: value}));

  return {selected, selectVariant};
}

export function ThemeVariantPicker() {
  const {selected, selectVariant} = useThemeVariants();

  return (
    <Stack gap="2xl" padding="xl">
      {THEME_VARIANT_SECTIONS.map(section => (
        <ThemeVariantGroup
          key={section.scheme}
          section={section}
          value={selected[section.scheme]}
          onChange={value => selectVariant(section.scheme, value)}
        />
      ))}
    </Stack>
  );
}

function ThemeVariantGroup({
  section,
  value,
  onChange,
}: {
  onChange: (value: string) => void;
  section: ThemeVariantSection;
  value: string;
}) {
  const headingId = useId();

  return (
    <Stack gap="md">
      <Heading as="h3" size="md" id={headingId}>
        {section.title}
      </Heading>
      <Grid
        role="radiogroup"
        aria-labelledby={headingId}
        columns="repeat(auto-fill, minmax(180px, 1fr))"
        gap="lg"
      >
        {section.variants.map(variant => (
          <ToggleCard
            key={variant.value}
            variant="radio"
            padding="md"
            name={`theme-variant-${section.scheme}`}
            value={variant.value}
            checked={value === variant.value}
            onChange={event => onChange(event.currentTarget.value)}
          >
            <Stack gap="md">
              <ThemePreview scheme={section.scheme} variant={variant.value} />
              <Text>{variant.label}</Text>
            </Stack>
          </ToggleCard>
        ))}
      </Grid>
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
