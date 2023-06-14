import {useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {CompactSelect} from 'sentry/components/compactSelect';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {
  CLICronQuickStart,
  CurlCronQuickStart,
  NodeJSCronQuickStart,
  PHPCronQuickStart,
  PHPLaravelCronQuickStart,
  PythonCeleryCronQuickStart,
  PythonCronQuickStart,
  QuickStartProps,
} from 'sentry/views/monitors/components/quickStartEntries';

import {Monitor} from '../types';

interface Props {
  monitor: Monitor;
  orgId: string;
}

interface OnboardingGuide {
  Guide: React.ComponentType<QuickStartProps>;
  label: string;
  platforms?: Set<PlatformKey>;
}

const onboardingGuides: Record<string, OnboardingGuide> = {
  cli: {
    label: 'Sentry CLI',
    Guide: CLICronQuickStart,
  },
  curl: {
    label: 'cURL',
    Guide: CurlCronQuickStart,
  },
  python: {
    label: 'Python',
    Guide: PythonCronQuickStart,
    platforms: new Set([
      'python',
      'python-django',
      'python-flask',
      'python-fastapi',
      'python-starlette',
      'python-sanic',
      'python-bottle',
      'python-pylons',
      'python-pyramid',
      'python-tornado',
      'python-rq',
    ]),
  },
  pythonCelery: {
    label: 'Celery',
    Guide: PythonCeleryCronQuickStart,
    platforms: new Set(['python-celery']),
  },
  php: {
    label: 'PHP',
    Guide: PHPCronQuickStart,
    platforms: new Set(['php', 'php-monolog', 'php-symfony2']),
  },
  phpLaravel: {
    label: 'Laravel',
    Guide: PHPLaravelCronQuickStart,
    platforms: new Set(['php-laravel']),
  },
  nodeJs: {
    label: 'Node',
    Guide: NodeJSCronQuickStart,
    platforms: new Set(['node']),
  },
};

const guideToSelectOption = ({key, label}) => ({label, value: key});

export default function MonitorQuickStartGuide({monitor, orgId}: Props) {
  const {data: projectKeys} = useApiQuery<Array<ProjectKey>>(
    [`/projects/${orgId}/${monitor.project.slug}/keys/`],
    {staleTime: Infinity}
  );

  const guideList = Object.entries(onboardingGuides).map(([key, guide]) => ({
    ...guide,
    key,
  }));

  const [genericGuides, platformGuides] = partition(
    guideList,
    guide => guide.platforms === undefined
  );

  const exampleOptions = [
    {label: t('Platform Specfiic'), options: platformGuides.map(guideToSelectOption)},
    {label: t('Generic'), options: genericGuides.map(guideToSelectOption)},
  ];

  const platformSpecific = platformGuides.filter(guide =>
    guide.platforms?.has(monitor.project.platform ?? 'other')
  );

  const defaultExample = platformSpecific.length > 0 ? platformSpecific[0].key : 'cli';

  const [selectedGuide, setSelectedGuide] = useState(defaultExample);
  const {Guide} = onboardingGuides[selectedGuide];

  return (
    <Container>
      <CompactSelect
        options={exampleOptions}
        value={selectedGuide}
        onChange={({value}) => setSelectedGuide(value)}
      />
      <Guide slug={monitor.slug} orgSlug={orgId} dsnKey={projectKeys?.[0].dsn.public} />
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
