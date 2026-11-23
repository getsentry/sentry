import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {openModal} from '@sentry/scraps/modal';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getPlatformInfo,
  platformOptionGroups,
  shouldSuggestFramework,
  toSelectedSdk,
} from './scm/scmPlatformHelpers';
import {
  FrameworkSuggestionModal,
  modalCss,
  SupportedLanguages,
} from './frameworkSuggestionModal';

const LANGUAGES = Object.values(SupportedLanguages)
  .map(key => getPlatformInfo(key))
  .filter(platform => platform !== undefined);

// Opens the prompt exactly like the SCM platform picker does, so the story
// exercises the real global modal, its scroll lock, and `modalCss`.
function openFrameworkSuggestionModal({
  organization,
  platformKey,
  onResult,
}: {
  onResult: (result: string) => void;
  organization: Organization;
  platformKey: PlatformKey;
}) {
  const platformInfo = getPlatformInfo(platformKey);
  if (!platformInfo) {
    return;
  }
  const baseSdk = toSelectedSdk(platformInfo);

  openModal(
    deps => (
      <FrameworkSuggestionModal
        {...deps}
        organization={organization}
        selectedPlatform={baseSdk}
        onConfigure={selectedFramework => {
          onResult(`Configured ${selectedFramework.name}`);
          deps.closeModal();
        }}
        onSkip={() => {
          onResult(`Skipped, kept ${baseSdk.name}`);
          deps.closeModal();
        }}
        isScmFlow
        analyticsFlow="project-creation"
      />
    ),
    {modalCss}
  );
}

export default Storybook.story('FrameworkSuggestionModal', story => {
  story('Default', () => {
    const organization = useOrganization();
    const [result, setResult] = useState<string | null>(null);

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="FrameworkSuggestionModal" /> asks which framework
          to set up after someone picks a base language. Each language has a different
          number of frameworks. Node.js and Python have enough to show the collapsed list,
          which makes the dialog grow taller.
        </p>
        <Flex gap="md" wrap="wrap">
          {LANGUAGES.map(platform => (
            <Button
              key={platform.id}
              onClick={() =>
                openFrameworkSuggestionModal({
                  organization,
                  platformKey: platform.id,
                  onResult: setResult,
                })
              }
            >
              {platform.name}
            </Button>
          ))}
        </Flex>
        {result && <Text as="p">{result}</Text>}
      </Fragment>
    );
  });

  story('Opened from a searchable picker', () => {
    const organization = useOrganization();
    const [platform, setPlatform] = useState<PlatformKey | null>(null);
    const [blurBeforeOpen, setBlurBeforeOpen] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    return (
      <Fragment>
        <p>
          In project creation, the prompt opens from the platform search. On a phone, the
          search input still has focus, so the on-screen keyboard is open when the modal
          opens. Open this story on a phone or in device emulation, search for “Node”, and
          pick Node.js. Turn on blurring to compare the same flow with the keyboard closed
          first.
        </p>
        <Stack gap="md" maxWidth="400px">
          <Flex as="label" gap="md" align="center">
            <Checkbox
              checked={blurBeforeOpen}
              onChange={() => setBlurBeforeOpen(value => !value)}
            />
            <Text>Blur the search input before opening the modal</Text>
          </Flex>
          <Select<string, (typeof platformOptionGroups)[number]['options'][number]>
            aria-label="Platform"
            placeholder="Search"
            options={platformOptionGroups}
            value={platform}
            searchable
            virtualized
            onChange={option => {
              const platformKey = option.value as PlatformKey;
              setPlatform(platformKey);
              if (!shouldSuggestFramework(platformKey)) {
                return;
              }
              if (blurBeforeOpen && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              openFrameworkSuggestionModal({
                organization,
                platformKey,
                onResult: setResult,
              });
            }}
          />
          {result && <Text as="p">{result}</Text>}
        </Stack>
      </Fragment>
    );
  });
});
