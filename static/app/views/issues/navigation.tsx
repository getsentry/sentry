import {Fragment, useEffect, useRef, useState} from 'react';
import {Reorder} from 'framer-motion';

import {IssueViewNavItemContent} from 'sentry/components/nav/issueViews/issueViewNavItemContent';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import type {IssueViewPF} from 'sentry/views/issueList/issueViewsPF/issueViewsPF';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';

interface IssuesWrapperProps extends RouteComponentProps {
  children: React.ReactNode;
}

export function IssueNavigation({children}: IssuesWrapperProps) {
  const organization = useOrganization();
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');
  const hasIssueViewsInLeftNav = organization?.features.includes('left-nav-issue-views');

  const sectionRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [views, setViews] = useState<IssueViewPF[] | null>(null);

  const {data: groupSearchViews} = useFetchGroupSearchViews(
    {
      orgSlug: organization.slug,
    },
    {
      enabled: hasIssueViewsInLeftNav,
    }
  );

  useEffect(() => {
    if (groupSearchViews) {
      setViews(
        groupSearchViews?.map(
          (
            {
              id,
              name,
              query: viewQuery,
              querySort: viewQuerySort,
              environments: viewEnvironments,
              projects: viewProjects,
              timeFilters: viewTimeFilters,
              isAllProjects,
            },
            index
          ): IssueViewPF => {
            const tabId = id ?? `default${index.toString()}`;

            return {
              id: tabId,
              key: tabId,
              label: name,
              query: viewQuery,
              querySort: viewQuerySort,
              environments: viewEnvironments,
              projects: isAllProjects ? [-1] : viewProjects,
              timeFilters: viewTimeFilters,
              isCommitted: true,
            };
          }
        )
      );
    }
  }, [groupSearchViews]);

  if (!hasNavigationV2) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/issues`;

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.ISSUES}>
        <SecondaryNav.Header>{t('Issues')}</SecondaryNav.Header>
        <SecondaryNav.Body ref={bodyRef}>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/`} end>
              {t('All')}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/feedback/`}>
              {t('Feedback')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          {hasIssueViewsInLeftNav && (
            <SecondaryNav.Section title={t('Views')}>
              <Reorder.Group
                as="div"
                axis="y"
                values={views ?? []}
                onReorder={setViews}
                initial={false}
                ref={sectionRef}
              >
                {views &&
                  views.length > 0 &&
                  views.map(view => (
                    <IssueViewNavItemContent
                      key={view.id}
                      view={view}
                      dragConstraints={sectionRef}
                      sectionBodyRef={bodyRef}
                    />
                  ))}
              </Reorder.Group>
            </SecondaryNav.Section>
          )}
        </SecondaryNav.Body>
        <SecondaryNav.Footer>
          <SecondaryNav.Item
            to={`${baseUrl}/alerts/rules/`}
            activeTo={`${baseUrl}/alerts/`}
          >
            {t('Alerts')}
          </SecondaryNav.Item>
        </SecondaryNav.Footer>
      </SecondaryNav>
      {children}
    </Fragment>
  );
}
