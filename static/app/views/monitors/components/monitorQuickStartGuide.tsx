import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';
import {
  CLICronQuickStart,
  CurlCronQuickStart,
  PythonCronQuickStart,
  QuickStartProps,
} from 'sentry/views/monitors/components/quickStartEntries';

interface Props {
  monitorSlug?: string;
  platform?: PlatformKey;
}

interface OnboardingGuide {
  guide: (props: QuickStartProps) => React.ReactNode;
  label: string;
  alwaysShown?: boolean;
  platforms?: Set<PlatformKey>;
}

const onboardingGuides: Record<string, OnboardingGuide> = {
  cli: {
    label: 'CLI',
    guide: ({slug}: QuickStartProps) => <CLICronQuickStart slug={slug} />,
    alwaysShown: true,
  },
  curl: {
    label: 'Curl',
    guide: ({slug}: QuickStartProps) => <CurlCronQuickStart slug={slug} />,
    alwaysShown: true,
  },
  python: {
    label: 'Python',
    platforms: new Set(['python', 'python-celery']),
    guide: ({slug}: QuickStartProps) => <PythonCronQuickStart slug={slug} />,
  },
};

const guideToSelectOption = ({key, label}) => ({label, value: key});

function getOptionsForPlatform(platform?: PlatformKey) {
  // Adds object key as a property of the guide for ease of access later
  const guidesWithKeys = Object.entries(onboardingGuides).map(([key, guide]) => ({
    ...guide,
    key,
  }));

  const alwaysShownOptions = guidesWithKeys
    .filter(guide => guide.alwaysShown)
    .map(guideToSelectOption);

  if (!platform) {
    return [{label: t('Examples'), options: alwaysShownOptions}];
  }

  const platformSpecificOptions = guidesWithKeys
    .filter(guide => guide.platforms?.has(platform))
    .map(guideToSelectOption);

  return [
    {label: t('Platform Examples'), options: platformSpecificOptions},
    {label: t('Examples'), options: alwaysShownOptions},
  ];
}

export default function MonitorQuickStartGuide({monitorSlug, platform}: Props) {
  const [selectedGuide, setSelectedGuide] = useState<OnboardingGuide>();

  function handleOnChange(selectedOption: SelectValue<string>) {
    const guide = onboardingGuides[selectedOption.value];
    setSelectedGuide(guide);
  }

  return (
    <Fragment>
      <FullWidthSelect
        options={getOptionsForPlatform(platform)}
        onChange={handleOnChange}
        triggerProps={{style: {width: '100%'}}}
      />
      {selectedGuide && selectedGuide.guide({slug: monitorSlug})}
    </Fragment>
  );
}

const FullWidthSelect = styled(CompactSelect)`
  width: 100%;
` as typeof CompactSelect;
