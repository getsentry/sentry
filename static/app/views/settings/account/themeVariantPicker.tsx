import {useId, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {themeVariables} from '@sentry/scraps/theme';
import {toast} from '@sentry/scraps/toast';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {updateUser} from 'sentry/actionCreators/account';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useUser} from 'sentry/utils/useUser';

type ColorScheme = 'light' | 'dark';

type ThemeVariantOption = 'themeVariantLight' | 'themeVariantDark';

type ThemeVariant = {label: string; value: string};

type ThemeVariantSection = {
  option: ThemeVariantOption;
  scheme: ColorScheme;
  title: string;
  variants: ThemeVariant[];
};

const DEFAULT_VARIANT = 'default';

// Each section is one radio group. Adding a theme is a new entry in `variants`.
const THEME_VARIANT_SECTIONS: ThemeVariantSection[] = [
  {
    option: 'themeVariantLight',
    scheme: 'light',
    title: t('Light'),
    variants: [{value: DEFAULT_VARIANT, label: t('Default')}],
  },
  {
    option: 'themeVariantDark',
    scheme: 'dark',
    title: t('Dark'),
    variants: [
      {value: DEFAULT_VARIANT, label: t('Default')},
      {value: 'ash', label: t('Ash')},
      {value: 'midnight', label: t('Midnight')},
    ],
  },
];

type SelectedVariants = Record<ThemeVariantOption, string>;

function savedVariants(user: User): SelectedVariants {
  return {
    themeVariantLight: user.options.themeVariantLight ?? DEFAULT_VARIANT,
    themeVariantDark: user.options.themeVariantDark ?? DEFAULT_VARIANT,
  };
}

/**
 * Reads each scheme's theme from the user's options and saves changes the
 * same way the Theme select does. The selection updates right away and goes
 * back to the saved value if the save fails.
 */
function useThemeVariants() {
  const user = useUser();
  const [selected, setSelected] = useState(() => savedVariants(user));

  const {mutate} = useMutation({
    mutationFn: (options: Partial<SelectedVariants>) =>
      fetchMutation<User>({
        method: 'PUT',
        url: getApiUrl('/users/$userId/', {path: {userId: 'me'}}),
        data: {options},
      }),
    onSuccess: updateUser,
    onError: () => {
      setSelected(savedVariants(user));
      toast.error(t('Unable to save your theme.'));
    },
  });

  const selectVariant = (option: ThemeVariantOption, value: string) => {
    setSelected(previous => ({...previous, [option]: value}));
    mutate({[option]: value});
  };

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
          value={selected[section.option]}
          onChange={value => selectVariant(section.option, value)}
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
