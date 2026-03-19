import {useCallback, useEffect, useState} from 'react';
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
import type {PlatformKey} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

import {FeatureSelectionCards} from './components/featureSelectionCards';
import {usePlatformDetection} from './components/usePlatformDetection';
import type {StepProps} from './types';

const getPlatformInfo = (key: PlatformKey) => platforms.find(p => p.id === key);

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

  const [showManualPicker, setShowManualPicker] = useState(false);
  const [localPlatformKey, setLocalPlatformKey] = useState<PlatformKey | undefined>(
    selectedPlatform?.key
  );
  const [localFeatures, setLocalFeatures] = useState<ProductSolution[]>(
    selectedFeatures ?? [ProductSolution.ERROR_MONITORING]
  );

  const {detectedPlatforms, isPending: isDetecting} = usePlatformDetection(
    hasScmConnected ? selectedRepository.id : undefined
  );

  // Auto-select the first detected platform when results load
  useEffect(() => {
    if (detectedPlatforms.length > 0 && !localPlatformKey) {
      setLocalPlatformKey(detectedPlatforms[0].platform);
    }
  }, [detectedPlatforms, localPlatformKey]);

  const handleToggleFeature = useCallback((feature: ProductSolution) => {
    setLocalFeatures(prev =>
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  }, []);

  const handleSelectDetectedPlatform = useCallback((platformKey: PlatformKey) => {
    setLocalPlatformKey(platformKey);
    setLocalFeatures([ProductSolution.ERROR_MONITORING]);
  }, []);

  const handleManualPlatformSelect = useCallback((platform: Platform | null) => {
    setLocalPlatformKey(platform?.id ?? undefined);
    setLocalFeatures([ProductSolution.ERROR_MONITORING]);
  }, []);

  const handleContinue = useCallback(() => {
    if (!localPlatformKey) {
      return;
    }

    const platformInfo = getPlatformInfo(localPlatformKey);
    if (platformInfo) {
      setSelectedPlatform({
        ...omit(platformInfo, 'id'),
        key: platformInfo.id,
        category: 'popular',
      });
    }
    setSelectedFeatures(localFeatures);
    onComplete();
  }, [
    localPlatformKey,
    localFeatures,
    setSelectedPlatform,
    setSelectedFeatures,
    onComplete,
  ]);

  const showDetectedPlatforms = hasScmConnected && !showManualPicker;

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
                  {detectedPlatforms.map(detected => {
                    const info = getPlatformInfo(detected.platform);
                    if (!info) {
                      return null;
                    }
                    const isSelected = localPlatformKey === detected.platform;
                    return (
                      <button
                        onClick={() => handleSelectDetectedPlatform(detected.platform)}
                        style={{
                          background: 'transparent',
                          textAlign: 'left',
                          border: 'none',
                          paddingInline: '0px',
                        }}
                        key={detected.platform}
                      >
                        <Container
                          border={isSelected ? 'accent' : 'secondary'}
                          padding="md"
                          radius="md"
                          // cursor="pointer"
                        >
                          <Flex gap="sm" align="center">
                            <PlatformIcon platform={detected.platform} size={20} />
                            <Stack gap="0">
                              <Text bold>{info.name}</Text>
                              <Text variant="muted" size="sm">
                                {info.type}
                              </Text>
                            </Stack>
                          </Flex>
                        </Container>
                      </button>
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
              platform={localPlatformKey ?? null}
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

        {localPlatformKey && (
          <FeatureSelectionCards
            platform={localPlatformKey}
            selectedFeatures={localFeatures}
            onToggleFeature={handleToggleFeature}
          />
        )}
      </Stack>

      <Flex gap="md" align="center">
        <Button onClick={() => onComplete()}>{t('Back')}</Button>
        <Button priority="primary" onClick={handleContinue} disabled={!localPlatformKey}>
          {t('Continue')}
        </Button>
      </Flex>
    </Flex>
  );
}
