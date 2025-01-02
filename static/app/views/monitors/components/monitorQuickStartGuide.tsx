import {useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, ProjectKey} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {QuickStartProps} from 'sentry/views/monitors/components/quickStartEntries';
import {
  CLICronQuickStart,
  CurlCronQuickStart,
  GoCronQuickStart,
  JavaCronQuickStart,
  JavaQuartzCronQuickStart,
  JavaSpringBootCronQuickStart,
  NodeJSCronQuickStart,
  PHPCronQuickStart,
  PHPLaravelCronQuickStart,
  PythonCeleryCronQuickStart,
  PythonCronQuickStart,
  RubyCronQuickStart,
  RubyRailsCronQuickStart,
  RubySidekiqCronQuickStart,
} from 'sentry/views/monitors/components/quickStartEntries';

import type {Monitor} from '../types';

interface Props {
  monitor: Monitor;
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
    platforms: new Set(['php', 'php-monolog', 'php-symfony']),
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
  go: {
    label: 'Go',
    Guide: GoCronQuickStart,
    platforms: new Set(['go']),
  },
  java: {
    label: 'Java',
    Guide: JavaCronQuickStart,
    platforms: new Set(['java', 'java-log4j2', 'java-logback']),
  },
  javaSpringBoot: {
    label: 'Spring',
    Guide: JavaSpringBootCronQuickStart,
    platforms: new Set(['java-spring-boot', 'java-spring']),
  },
  javaQuartz: {
    label: 'Quartz',
    Guide: JavaQuartzCronQuickStart,
    platforms: new Set([
      'java',
      'java-log4j2',
      'java-logback',
      'java-spring-boot',
      'java-spring',
    ]),
  },
  ruby: {
    label: 'Ruby',
    Guide: RubyCronQuickStart,
    platforms: new Set(['ruby']),
  },
  rubyRails: {
    label: 'Rails',
    Guide: RubyRailsCronQuickStart,
    platforms: new Set(['ruby', 'ruby-rails']),
  },
  rubySidekiq: {
    label: 'Sidekiq',
    Guide: RubySidekiqCronQuickStart,
    platforms: new Set(['ruby', 'ruby-rails']),
  },
};

/**
 * The platforms that are well supported for crons
 */
export const platformsWithGuides = Array.from(
  Object.values(onboardingGuides).reduce((combinedPlatforms, guide) => {
    guide.platforms?.forEach(platform => combinedPlatforms.add(platform));
    return combinedPlatforms;
  }, new Set())
);

const guideToSelectOption = ({key, label}) => ({label, value: key});

export default function MonitorQuickStartGuide({monitor}: Props) {
  const org = useOrganization();

  const {data: projectKeys} = useApiQuery<Array<ProjectKey>>(
    [`/projects/${org.slug}/${monitor.project.slug}/keys/`],
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

  const defaultExample = platformSpecific.length > 0 ? platformSpecific[0]!.key : 'cli';

  const [selectedGuide, setSelectedGuide] = useState(defaultExample);
  const {Guide} = onboardingGuides[selectedGuide]!;

  return (
    <Container>
      <CompactSelect
        options={exampleOptions}
        value={selectedGuide}
        onChange={({value}) => setSelectedGuide(value)}
      />
      <Guide
        slug={monitor.slug}
        orgSlug={org.slug}
        orgId={org.id}
        projectId={monitor.project.id}
        cronsUrl={projectKeys?.[0]!.dsn.crons}
        dsnKey={projectKeys?.[0]!.dsn.public}
      />
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
