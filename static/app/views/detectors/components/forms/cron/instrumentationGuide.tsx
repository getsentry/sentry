import {Fragment, useEffect, useRef} from 'react';
import partition from 'lodash/partition';
import {parseAsBoolean, useQueryState} from 'nuqs';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconGlobe, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';
import {useCronDetectorFormField} from 'sentry/views/detectors/components/forms/cron/fields';
import {
  platformGuides,
  type GuideKey,
} from 'sentry/views/insights/crons/components/upsertPlatformGuides';
import {
  toSupportedPlatform,
  useCronsUpsertGuideState,
} from 'sentry/views/insights/crons/components/useCronsUpsertGuideState';

const [genericPlatforms, regularPlatforms] = partition(platformGuides, p =>
  ['cli', 'http'].includes(p.platform)
);

const genericIcons: Record<string, React.ReactNode> = {
  cli: <IconTerminal size="sm" />,
  http: <IconGlobe size="sm" />,
};

export function InstrumentationGuide() {
  const {projects} = useProjects();
  const projectId = useCronDetectorFormField('projectId');
  const [skipGuideDetection] = useQueryState('skipGuideDetection', parseAsBoolean);

  const selectedProject = projects.find(p => p.id === projectId);
  const projectPlatform = selectedProject?.platform;

  const {platform, platformKey, guideKey, guide, setPlatformGuide} =
    useCronsUpsertGuideState();

  const startingPlatformRef = useRef(platformKey);
  const isFirstRender = useRef(true);

  // auto-select a valid upsert guide if one is available for the selected
  // projects platform
  useEffect(() => {
    // Skip if skipGuideDetection param is set
    if (skipGuideDetection) {
      return;
    }

    if (!projectPlatform) {
      return;
    }

    // We want to avoid overrwiting the selected platform guide when the page
    // first loads if it was already set in the query state.
    const skipSettingGuide =
      isFirstRender.current && startingPlatformRef.current !== null;
    isFirstRender.current = false;

    if (skipSettingGuide) {
      return;
    }

    // Attempt to find a supported upsert platform using th project platform.
    // Make a second attempt if the exact project platform has no guides by
    // extracting the 'first part' of the platform.
    //
    // Eg, there may be no `node-express` cron upsert guide, but there is a
    // `node` guide.
    const defaultPlatform =
      toSupportedPlatform(projectPlatform) ??
      toSupportedPlatform(projectPlatform.split('-').at(0) as PlatformKey);

    if (!defaultPlatform) {
      setPlatformGuide(null);
      return;
    }

    setPlatformGuide(defaultPlatform);
  }, [projectPlatform, setPlatformGuide, skipGuideDetection]);

  const platformItems = regularPlatforms.map<MenuItemProps>(c => {
    const item = {
      key: c.platform,
      label: c.label,
      leadingItems: <PlatformIcon platform={c.platform} size={20} />,
    };

    // If platform has exactly one guide, select it directly
    if (c.guides.length === 1) {
      return {
        ...item,
        onAction: () => setPlatformGuide(c.platform, c.guides[0].key),
      };
    }

    const children = c.guides.map(g => ({
      key: g.key,
      label: g.title,
      onAction: () => setPlatformGuide(c.platform, g.key),
    }));

    return {...item, children, isSubmenu: true};
  });

  const genericItems: MenuItemProps = {
    key: 'generic',
    label: t('Generic'),
    children: genericPlatforms.map(cronPlatform => ({
      key: cronPlatform.platform,
      label: cronPlatform.label,
      leadingItems: genericIcons[cronPlatform.platform],
      onAction: () =>
        setPlatformGuide(cronPlatform.platform, cronPlatform.guides[0]?.key ?? 'manual'),
    })),
  };

  const menuItems: MenuItemProps[] = [...platformItems, genericItems];

  const selectedLabel =
    platform && guide
      ? `${platform.label} - ${guide.title}`
      : platform
        ? platform.label
        : t('Select Platform');

  const showAutoInstrumentationGuide = platform && guide && guideKey !== 'manual';

  return (
    <Fragment>
      <Container>
        <Section title={t('Select Instrumentation Method')}>
          <Text variant="muted">
            {t(
              'You may not need to manually create your Cron Monitors! Configure your SDK to automatically create cron monitors.'
            )}
          </Text>
          <Flex gap="lg" align="center" paddingTop="lg">
            <DropdownMenu
              size="sm"
              items={menuItems}
              triggerLabel={selectedLabel}
              triggerProps={{
                icon: platformKey ? (
                  <PlatformIcon platform={platformKey} size={16} />
                ) : undefined,
              }}
            />
            {showAutoInstrumentationGuide && (
              <Fragment>
                <Text size="sm" variant="muted">
                  {t('or')}
                </Text>
                <Button size="xs" onClick={() => setPlatformGuide(null)}>
                  {t('Manually Create a Monitor')}
                </Button>
              </Fragment>
            )}
          </Flex>
        </Section>
      </Container>

      {showAutoInstrumentationGuide && (
        <Container>
          <Section
            title={t('Auto-Instrument with %s', platform.label)}
            trailingItems={
              platform.guides.length > 1 ? (
                <CompactSelect
                  size="xs"
                  triggerProps={{borderless: true, size: 'zero'}}
                  value={guideKey ?? 'upsert'}
                  onChange={option => {
                    setPlatformGuide(platformKey, option.value);
                  }}
                  options={platform.guides.map(g => ({
                    value: g.key as GuideKey,
                    label: g.title,
                  }))}
                />
              ) : undefined
            }
          >
            <Flex direction="column" gap="lg">
              <guide.Guide />
            </Flex>
          </Section>
        </Container>
      )}
    </Fragment>
  );
}
