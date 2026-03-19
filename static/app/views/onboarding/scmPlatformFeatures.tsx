import {useCallback, useEffect, useMemo, useState} from 'react';
import omit from 'lodash/omit';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import type {Platform} from 'sentry/components/platformPicker';
import {PlatformPicker} from 'sentry/components/platformPicker';
import {platforms} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

import {FeatureSelectionCards} from './components/featureSelectionCards';
import {getAvailableFeaturesForPlatform} from './components/platformDetection';
import {UnstyledButton} from './components/unstyledButton';
import {usePlatformDetection} from './components/usePlatformDetection';
import type {StepProps} from './types';

const platformsByKey = new Map(platforms.map(p => [p.id, p]));

const getPlatformInfo = (key: PlatformKey) => platformsByKey.get(key);

function setPlatformInContext(
  platformKey: PlatformKey,
  setSelectedPlatform: (sdk?: OnboardingSelectedSDK) => void
) {
  const platformInfo = getPlatformInfo(platformKey);
  if (platformInfo) {
    setSelectedPlatform({
      ...omit(platformInfo, 'id'),
      key: platformInfo.id,
      category: 'popular',
    });
  }
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

  const hasScmConnected = !!selectedRepository;

  const {detectedPlatforms, isPending: isDetecting} = usePlatformDetection(
    hasScmConnected ? selectedRepository.id : undefined
  );

  const [showManualPicker, setShowManualPicker] = useState(false);

  const currentFeatures = useMemo(
    () => selectedFeatures ?? [ProductSolution.ERROR_MONITORING],
    [selectedFeatures]
  );

  const resolvedPlatforms = useMemo(
    () =>
      detectedPlatforms.reduce<
        Array<
          (typeof detectedPlatforms)[number] & {
            info: NonNullable<ReturnType<typeof getPlatformInfo>>;
          }
        >
      >((acc, detected) => {
        const info = getPlatformInfo(detected.platform);
        if (info) {
          acc.push({...detected, info});
        }
        return acc;
      }, []),
    [detectedPlatforms]
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

  const handleSelectDetectedPlatform = useCallback(
    (platformKey: PlatformKey) => {
      setPlatformInContext(platformKey, setSelectedPlatform);
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    },
    [setSelectedPlatform, setSelectedFeatures]
  );

  const handleManualPlatformSelect = useCallback(
    (platform: Platform | null) => {
      if (platform) {
        setPlatformInContext(platform.id, setSelectedPlatform);
      } else {
        setSelectedPlatform(undefined);
      }
      setSelectedFeatures([ProductSolution.ERROR_MONITORING]);
    },
    [setSelectedPlatform, setSelectedFeatures]
  );

  const showDetectedPlatforms = hasScmConnected && !showManualPicker;
  const detectedPlatformKey = resolvedPlatforms[0]?.platform;
  const currentPlatformKey = selectedPlatform?.key;

  // Auto-select the first detected platform when results load
  useEffect(() => {
    if (detectedPlatformKey && !currentPlatformKey) {
      setPlatformInContext(detectedPlatformKey, setSelectedPlatform);
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
                      <UnstyledButton
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
                      </UnstyledButton>
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
            <PlatformPicker
              noAutoFilter
              visibleSelection={false}
              source="scm-onboarding"
              platform={currentPlatformKey ?? null}
              setPlatform={handleManualPlatformSelect}
              organization={organization}
            />
            {hasScmConnected && (
              <Button
                size="zero"
                priority="transparent"
                onClick={() => setShowManualPicker(false)}
              >
                {t('Back to recommended platforms')}
              </Button>
            )}
          </Stack>
        )}

        {currentPlatformKey && (
          <FeatureSelectionCards
            availableFeatures={[
              ...new Set([
                ProductSolution.ERROR_MONITORING,
                ...getAvailableFeaturesForPlatform(currentPlatformKey),
              ]),
            ]}
            selectedFeatures={currentFeatures}
            onToggleFeature={handleToggleFeature}
          />
        )}
      </Stack>

      <Flex gap="md" align="center">
        <Button onClick={() => onComplete()}>{t('Back')}</Button>
        <Button
          priority="primary"
          onClick={() => onComplete()}
          disabled={!currentPlatformKey}
        >
          {t('Continue')}
        </Button>
      </Flex>
    </Flex>
  );
}
