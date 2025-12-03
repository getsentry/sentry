import {useState} from 'react';
import partition from 'lodash/partition';
import {PlatformIcon} from 'platformicons';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {IconGlobe, IconTerminal} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {PlatformKey, Project, ProjectKey} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {QuickStartProps} from 'sentry/views/insights/crons/components/manualCheckInGuides';
import {
  CLICronQuickStart,
  CurlCronQuickStart,
  DotNetCronQuickStart,
  DotNetHangfireCronQuickStart,
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
} from 'sentry/views/insights/crons/components/manualCheckInGuides';

interface Props {
  monitorSlug: string;
  project: Project;
}

interface OnboardingGuide {
  Guide: React.ComponentType<QuickStartProps>;
  icon: React.ReactNode;
  label: string;
  platforms?: Set<PlatformKey>;
}

const onboardingGuides: Record<string, OnboardingGuide> = {
  cli: {
    label: 'Sentry CLI',
    icon: <IconTerminal size="sm" />,
    Guide: CLICronQuickStart,
  },
  curl: {
    label: 'cURL',
    icon: <IconGlobe size="sm" />,
    Guide: CurlCronQuickStart,
  },
  python: {
    label: 'Python',
    icon: <PlatformIcon size={16} platform="python" />,
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
    icon: <PlatformIcon size={16} platform="python-celery" />,
    Guide: PythonCeleryCronQuickStart,
    platforms: new Set(['python-celery']),
  },
  php: {
    label: 'PHP',
    icon: <PlatformIcon size={16} platform="php" />,
    Guide: PHPCronQuickStart,
    platforms: new Set(['php', 'php-monolog', 'php-symfony']),
  },
  phpLaravel: {
    label: 'Laravel',
    icon: <PlatformIcon size={16} platform="php-laravel" />,
    Guide: PHPLaravelCronQuickStart,
    platforms: new Set(['php-laravel']),
  },
  nodeJs: {
    label: 'Node',
    icon: <PlatformIcon size={16} platform="node" />,
    Guide: NodeJSCronQuickStart,
    platforms: new Set(['node']),
  },
  go: {
    label: 'Go',
    icon: <PlatformIcon size={16} platform="go" />,
    Guide: GoCronQuickStart,
    platforms: new Set(['go']),
  },
  java: {
    label: 'Java',
    icon: <PlatformIcon size={16} platform="java" />,
    Guide: JavaCronQuickStart,
    platforms: new Set(['java', 'java-log4j2', 'java-logback']),
  },
  javaSpringBoot: {
    label: 'Spring',
    icon: <PlatformIcon size={16} platform="java-spring" />,
    Guide: JavaSpringBootCronQuickStart,
    platforms: new Set(['java-spring-boot', 'java-spring']),
  },
  javaQuartz: {
    label: 'Quartz',
    Guide: JavaQuartzCronQuickStart,
    icon: <PlatformIcon size={16} platform="java-spring" />,
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
    icon: <PlatformIcon size={16} platform="ruby" />,
    Guide: RubyCronQuickStart,
    platforms: new Set(['ruby']),
  },
  rubyRails: {
    label: 'Rails',
    icon: <PlatformIcon size={16} platform="ruby-rails" />,
    Guide: RubyRailsCronQuickStart,
    platforms: new Set(['ruby', 'ruby-rails']),
  },
  rubySidekiq: {
    label: 'Sidekiq',
    icon: <PlatformIcon size={16} platform="ruby" />,
    Guide: RubySidekiqCronQuickStart,
    platforms: new Set(['ruby', 'ruby-rails']),
  },
  dotnet: {
    label: '.NET',
    icon: <PlatformIcon size={16} platform="dotnet" />,
    Guide: DotNetCronQuickStart,
    platforms: new Set([
      'dotnet',
      'dotnet-aspnet',
      'dotnet-aspnetcore',
      'dotnet-awslambda',
      'dotnet-gcpfunctions',
      'dotnet-maui',
      'dotnet-uwp',
      'dotnet-winforms',
      'dotnet-wpf',
      'dotnet-xamarin',
    ]),
  },
  dotnetHangfire: {
    label: 'Hangfire',
    icon: <PlatformIcon size={16} platform="dotnet" />,
    Guide: DotNetHangfireCronQuickStart,
    platforms: new Set([
      'dotnet',
      'dotnet-aspnet',
      'dotnet-aspnetcore',
      'dotnet-awslambda',
      'dotnet-gcpfunctions',
      'dotnet-maui',
      'dotnet-uwp',
      'dotnet-winforms',
      'dotnet-wpf',
      'dotnet-xamarin',
    ]),
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

const guideToSelectOption = ({key, label, icon}: {key: string} & OnboardingGuide) => ({
  label,
  value: key,
  leadingItems: <div>{icon}</div>,
});

export default function MonitorQuickStartGuide({monitorSlug, project}: Props) {
  const org = useOrganization();

  const {data: projectKeys} = useApiQuery<ProjectKey[]>(
    [`/projects/${org.slug}/${project.slug}/keys/`],
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
    guide.platforms?.has(project.platform ?? 'other')
  );

  const defaultExample = platformSpecific.length > 0 ? platformSpecific[0]!.key : 'cli';

  const [selectedGuide, setSelectedGuide] = useState(defaultExample);
  const {Guide} = onboardingGuides[selectedGuide]!;

  return (
    <Flex gap="xl" direction="column">
      <Text>
        {tct(
          'Select an integration method for your monitor. For in-depth instructions on integrating Crons, view [docsLink:our complete documentation].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/product/crons/getting-started/" />
            ),
          }
        )}
      </Text>
      <CompactSelect
        triggerProps={{prefix: t('Guide')}}
        searchable
        options={exampleOptions}
        value={selectedGuide}
        onChange={({value}) => setSelectedGuide(value)}
        size="sm"
      />
      <Guide
        slug={monitorSlug}
        orgSlug={org.slug}
        orgId={org.id}
        projectId={project.id}
        cronsUrl={projectKeys?.[0]!.dsn.crons}
        dsnKey={projectKeys?.[0]!.dsn.public}
      />
    </Flex>
  );
}
