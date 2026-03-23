import {useCallback, useEffect, useMemo, useState} from 'react';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {closeModal, openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {platformProductAvailability} from 'sentry/components/onboarding/productSelection';
import {platforms} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ScmCardButton} from 'sentry/views/onboarding/components/scmCardButton';
import {ScmFeatureSelectionCards} from 'sentry/views/onboarding/components/scmFeatureSelectionCards';

import {
  useScmPlatformDetection,
  type DetectedPlatform,
} from './components/useScmPlatformDetection';
import type {StepProps} from './types';

interface ResolvedPlatform extends DetectedPlatform {
  info: PlatformIntegration;
}

const platformsByKey = new Map(platforms.map(p => [p.id, p]));

const getPlatformInfo = (key: PlatformKey) => platformsByKey.get(key);

function getAvailableFeaturesForPlatform(platformKey: PlatformKey): ProductSolution[] {
  return platformProductAvailability[platformKey] ?? [];
}

const platformOptions = platforms.map(platform => ({
  value: platform.id,
  label: platform.name,
  textValue: `${platform.name} ${platform.id}`,
  leadingItems: () => <PlatformIcon platform={platform.id} size={16} />,
}));

function shouldSuggestFramework(platformKey: PlatformKey): boolean {
  const info = getPlatformInfo(platformKey);
  return (
    info?.type === 'language' &&
    Object.values(SupportedLanguages).includes(info.language as SupportedLanguages)
  );
}

export function ScmPlatformFeatures({onComplete}: StepProps) {
  const organization = useOrganization();
  const {
    selectedRepository,
    selectedPlatform,
    setSelectedPlatform,
    selectedFeatures,
    setSelectedFeatures,
  } = useOnboardingContext();

  const [showManualPicker, setShowManualPicker] = useState(false);

  const setPlatform = useCallback(
    (platformKey: PlatformKey) => {
      const platformInfo = getPlatformInfo(platformKey);
      if (platformInfo) {
        const {id: _id, ...platformInfoSelect} = platformInfo;

        setSelectedPlatform({
          ...platformInfoSelect,
          key: platformInfo.id,
          category: 'popular',
        });
      }
    },
    [setSelectedPlatform]
  );

  const hasScmConnected = !!selectedRepository;

  const {detectedPlatforms, isPending: isDetecting} = useScmPlatformDetection(
    hasScmConnected ? selectedRepository.id : undefined
  );

  const currentFeatures = useMemo(
    () => selectedFeatures ?? [ProductSolution.ERROR_MONITORING],
    [selectedFeatures]
  );

  const resolvedPlatforms = useMemo(
    () =>
      detectedPlatforms.reduce<ResolvedPlatform[]>((acc, detected) => {
        const info = getPlatformInfo(detected.platform);
        if (info) {
          acc.push({...detected, info});
        }
        return acc;
      }, []),
    [detectedPlatforms]
  );

  const availableFeatures = useMemo(
    () =>
      selectedPlatform?.key
        ? [
            ...new Set([
              ProductSolution.ERROR_MONITORING,
              ...getAvailableFeaturesForPlatform(selectedPlatform.key),
            ]),
          ]
        : [],
    [selectedPlatform?.key]
  );

  const handleToggleFeature = useCallback(
    (feature: ProductSolution) => {
      const updated = currentFeatures.includes(feature)
        ? currentFeatures.filter(f => f !== feature)
        : [...currentFeatures, feature];
      setSelectedFeatures(updated);
    },
    [currentFeatures, setSelectedFeatures]
  );

  const applyPlatformSelection = useCallback(
    (sdk: OnboardingSelectedSDK) => {
      setSelectedPlatform(sdk);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    },
    [setSelectedPlatform, setSelectedFeatures]
  );

  const handleManualPlatformSelect = useCallback(
    async (option: {value: string}) => {
      const platformKey = option.value as PlatformKey;
      if (platformKey === selectedPlatform?.key) {
        return;
      }

      // Block disabled gaming/console platforms
      const platformInfo = getPlatformInfo(platformKey);
      if (
        platformInfo &&
        isDisabledGamingPlatform({
          platform: {...platformInfo, category: 'popular'},
          enabledConsolePlatforms: organization.enabledConsolePlatforms,
        })
      ) {
        openConsoleModal({
          organization,
          selectedPlatform: {
            key: platformInfo.id,
            name: platformInfo.name,
            language: platformInfo.language,
            type: platformInfo.type,
            link: platformInfo.link,
            category: 'popular',
          },
          origin: 'onboarding',
        });
        return;
      }

      // For base languages (JavaScript, Python, etc.), show a modal suggesting
      // specific frameworks — matching the legacy onboarding behavior.
      if (platformInfo && shouldSuggestFramework(platformKey)) {
        const basePlatformSdk: OnboardingSelectedSDK = {
          key: platformInfo.id,
          name: platformInfo.name,
          language: platformInfo.language,
          type: platformInfo.type,
          link: platformInfo.link,
          category: 'popular',
        };

        const {FrameworkSuggestionModal, modalCss} =
          await import('sentry/components/onboarding/frameworkSuggestionModal');

        openModal(
          deps => (
            <FrameworkSuggestionModal
              {...deps}
              organization={organization}
              selectedPlatform={basePlatformSdk}
              onConfigure={selectedFramework => {
                applyPlatformSelection(selectedFramework);
                closeModal();
              }}
              onSkip={() => {
                applyPlatformSelection(basePlatformSdk);
                closeModal();
              }}
              newOrg
            />
          ),
          {modalCss}
        );
        return;
      }

      setPlatform(platformKey);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    },
    [
      selectedPlatform?.key,
      setPlatform,
      setSelectedFeatures,
      applyPlatformSelection,
      organization,
    ]
  );

  const handleSelectDetectedPlatform = useCallback(
    (platformKey: PlatformKey) => {
      if (platformKey === selectedPlatform?.key) {
        return;
      }
      setPlatform(platformKey);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    },
    [selectedPlatform?.key, setPlatform, setSelectedFeatures]
  );

  const detectedPlatformKey = resolvedPlatforms[0]?.platform;
  const currentPlatformKey = selectedPlatform?.key;

  // If the user previously selected a platform manually (not in the detected
  // list), show the manual picker so their selection is visible.
  const currentPlatformIsDetected = resolvedPlatforms.some(
    p => p.platform === currentPlatformKey
  );
  const showDetectedPlatforms =
    hasScmConnected &&
    !showManualPicker &&
    (!currentPlatformKey || currentPlatformIsDetected);

  // Auto-select the first detected platform when results load
  useEffect(() => {
    if (detectedPlatformKey && !currentPlatformKey) {
      setPlatform(detectedPlatformKey);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlatformKey, detectedPlatformKey]);

  return (
    <Flex direction="column" align="center" gap="xl" flexGrow={1}>
      <Stack align="center" gap="md">
        <Heading as="h2">{t('Platform & features')}</Heading>
        <Text variant="muted">
          {t('Select your SDK first, then choose the features to enable.')}
        </Text>
      </Stack>

      <Stack gap="lg" width="100%" maxWidth="600px">
        {showDetectedPlatforms ? (
          <Stack gap="md">
            <Heading as="h3">{t('Recommended SDK')}</Heading>
            {isDetecting ? (
              <Flex justify="center" padding="xl">
                <LoadingIndicator mini />
              </Flex>
            ) : (
              <Stack gap="sm">
                <Flex gap="md" wrap="wrap">
                  {resolvedPlatforms.map(({platform, info}) => {
                    const isSelected = currentPlatformKey === platform;
                    return (
                      <ScmCardButton
                        onClick={() => handleSelectDetectedPlatform(platform)}
                        key={platform}
                      >
                        <Container
                          border={isSelected ? 'accent' : 'secondary'}
                          padding="md"
                          radius="md"
                        >
                          <Flex gap="sm" align="center">
                            <PlatformIcon platform={platform} size={20} />
                            <Stack gap="0">
                              <Text bold>{info.name}</Text>
                              <Text variant="muted" size="sm">
                                {info.type}
                              </Text>
                            </Stack>
                          </Flex>
                        </Container>
                      </ScmCardButton>
                    );
                  })}
                </Flex>
                <Button
                  size="zero"
                  priority="transparent"
                  onClick={() => setShowManualPicker(true)}
                >
                  {t("Doesn't look right? Change platform")}
                </Button>
              </Stack>
            )}
          </Stack>
        ) : (
          <Stack gap="md">
            <Heading as="h3">{t('Select a platform')}</Heading>
            <CompactSelect
              search={{
                placeholder: t('Search SDKs by name...'),
              }}
              options={platformOptions}
              value={currentPlatformKey ?? ''}
              onChange={handleManualPlatformSelect}
              virtualizeThreshold={50}
            />
            {hasScmConnected && (
              <Button
                size="zero"
                priority="transparent"
                onClick={() => {
                  setShowManualPicker(false);
                  if (detectedPlatformKey) {
                    setPlatform(detectedPlatformKey);
                    setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
                  }
                }}
              >
                {t('Back to recommended platforms')}
              </Button>
            )}
          </Stack>
        )}

        {availableFeatures.length > 0 && (
          <ScmFeatureSelectionCards
            availableFeatures={availableFeatures}
            selectedFeatures={currentFeatures}
            onToggleFeature={handleToggleFeature}
          />
        )}
      </Stack>

      <Button
        priority="primary"
        onClick={() => onComplete()}
        disabled={!currentPlatformKey}
      >
        {t('Continue')}
      </Button>
    </Flex>
  );
}
