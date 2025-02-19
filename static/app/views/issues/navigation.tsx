import {Fragment, useEffect, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Reorder} from 'framer-motion';

import {IssueViewNavItemContent} from 'sentry/components/nav/issueViews/issueViewNavItemContent';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {IssueViewPF} from 'sentry/views/issueList/issueViewsPF/issueViewsPF';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';

interface IssuesWrapperProps extends RouteComponentProps {
  children: React.ReactNode;
}

export function IssueNavigation({children}: IssuesWrapperProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {viewId} = useParams();
  const queryParams = location.query;
  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');
  const hasIssueViewsInLeftNav = organization?.features.includes('left-nav-issue-views');

  const sectionRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (viewId && !views?.find(v => v.id === viewId)) {
      navigate(
        normalizeUrl({
          pathname: `${baseUrl}/`,
          query: queryParams,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  if (!hasNavigationV2) {
    return children;
  }

  const baseUrl = `/organizations/${organization.slug}/issues`;

  return (
    <Fragment>
      <SecondaryNav group={PrimaryNavGroup.ISSUES}>
        <SecondaryNav.Header>{t('Issues')}</SecondaryNav.Header>
        <SecondaryNav.Body>
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/`} end>
              {t('All')}
            </SecondaryNav.Item>
            <SecondaryNav.Item to={`${baseUrl}/feedback/`}>
              {t('Feedback')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
          {
            <SecondaryNav.Section title={t('Views')}>
              <Reorder.Group
                as="div"
                axis="y"
                values={views ?? []}
                onReorder={setViews}
                initial={false}
                ref={sectionRef}
              >
                {views?.map(view => (
                  <IssueViewNavItemContent
                    key={view.id}
                    view={view}
                    sectionRef={sectionRef}
                  />
                ))}
              </Reorder.Group>
            </SecondaryNav.Section>
          }
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
