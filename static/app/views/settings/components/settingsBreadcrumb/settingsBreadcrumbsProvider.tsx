import {useMatches} from 'react-router';

import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {unreachable} from 'sentry/utils/unreachable';
import {useParams} from 'sentry/utils/useParams';

import {SettingsBreadcrumbsContext} from './context';
import {IntegrationCrumb} from './integrationCrumb';
import {ProjectCrumb} from './projectCrumb';
import {SettingsBreadcrumbItemProvider} from './settingsBreadcrumbItemProvider';
import {TeamCrumb} from './teamCrumb';
import type {SettingsBreadcrumb} from './types';

export function SettingsBreadcrumbsProvider({children}: {children: React.ReactNode}) {
  const matches = useMatches();
  const params = useParams();
  const items = matches.flatMap(
    match =>
      (match.handle as {settingsBreadcrumb?: SettingsBreadcrumb} | undefined)
        ?.settingsBreadcrumb ?? []
  );

  const content = items.reduceRight<React.ReactNode>((child, item, index) => {
    switch (item.type) {
      case 'link':
        return (
          <SettingsBreadcrumbItemProvider
            key={index}
            item={{...item, to: replaceRouterParams(item.to, params)}}
          >
            {child}
          </SettingsBreadcrumbItemProvider>
        );
      case 'project':
        return (
          <ProjectCrumb key={index} to={item.to} switchTo={item.switchTo}>
            {child}
          </ProjectCrumb>
        );
      case 'team':
        return (
          <TeamCrumb key={index} to={item.to} switchTo={item.switchTo}>
            {child}
          </TeamCrumb>
        );
      case 'integration':
      case 'sentry-app':
        return (
          <IntegrationCrumb
            key={index}
            to={item.to}
            switchTo={item.switchTo}
            isSentryAppRoute={item.type === 'sentry-app'}
          >
            {child}
          </IntegrationCrumb>
        );
      default:
        return unreachable(item);
    }
  }, children);

  return <SettingsBreadcrumbsContext value={[]}>{content}</SettingsBreadcrumbsContext>;
}
