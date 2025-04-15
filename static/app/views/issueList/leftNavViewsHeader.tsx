import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import {makeFetchGroupSearchViewKey} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

type LeftNavViewsHeaderProps = {
  selectedProjectIds: number[];
};

function LeftNavViewsHeader({selectedProjectIds}: LeftNavViewsHeaderProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const prefersStackedNav = usePrefersStackedNav();
  const queryClient = useQueryClient();

  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchView} = useSelectedGroupSearchView();
  const {mutate: mutateViewStarred} = useUpdateGroupSearchViewStarred({
    onMutate: variables => {
      setApiQueryData<GroupSearchView>(
        queryClient,
        makeFetchGroupSearchViewKey({
          orgSlug: organization.slug,
          id: variables.id,
        }),
        oldGroupSearchView =>
          oldGroupSearchView
            ? {...oldGroupSearchView, starred: variables.starred}
            : oldGroupSearchView
      );
    },
    onError: (_error, variables) => {
      setApiQueryData<GroupSearchView>(
        queryClient,
        makeFetchGroupSearchViewKey({
          orgSlug: organization.slug,
          id: variables.id,
        }),
        oldGroupSearchView =>
          oldGroupSearchView
            ? {...oldGroupSearchView, starred: !variables.starred}
            : oldGroupSearchView
      );
    },
  });

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <StyledLayoutTitle>
          {groupSearchView ? (
            <Fragment>
              {groupSearchView.name}
              {organization.features.includes('issue-view-sharing') ? (
                <Button
                  onClick={() => {
                    mutateViewStarred({
                      id: groupSearchView.id,
                      starred: !groupSearchView?.starred,
                      view: groupSearchView,
                    });
                  }}
                  aria-label={
                    groupSearchView?.starred ? t('Unstar view') : t('Star view')
                  }
                  icon={
                    <IconStar
                      isSolid={groupSearchView?.starred}
                      color={groupSearchView?.starred ? 'yellow300' : 'subText'}
                    />
                  }
                />
              ) : null}
            </Fragment>
          ) : (
            t('Issues')
          )}
        </StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
    </Layout.Header>
  );
}

export default LeftNavViewsHeader;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;

const StyledLayoutTitle = styled(Layout.Title)`
  display: flex;
  justify-content: space-between;
`;
