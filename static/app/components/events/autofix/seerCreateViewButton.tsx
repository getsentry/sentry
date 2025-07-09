import {useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  type GroupSearchView,
  GroupSearchViewCreatedBy,
} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

interface StarFixabilityViewButtonProps {
  isCompleted: boolean;
  project: Project;
}

function StarFixabilityViewButton({isCompleted, project}: StarFixabilityViewButtonProps) {
  const organization = useOrganization();

  const {mutate: createIssueView} = useCreateGroupSearchView({
    onMutate: () => {
      addLoadingMessage(t('Creating view...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('View starred successfully'));
    },
    onError: () => {
      addErrorMessage(t('Failed to create view'));
    },
  });

  const {mutate: starExistingView} = useUpdateGroupSearchViewStarred({
    onMutate: () => {
      addLoadingMessage(t('Starring view...'));
    },
    onSuccess: () => {
      addSuccessMessage(t('View starred successfully'));
    },
    onError: () => {
      addErrorMessage(t('Failed to star view'));
    },
  });

  // Fetch all views to check for existing ones with our target name
  const {data: othersViews = []} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
    limit: 20,
    query: 'Easy Fixes 🤖', // Search by name
    sort: ['-popularity'],
    createdBy: GroupSearchViewCreatedBy.OTHERS,
  });

  const {data: myViews = []} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
    limit: 20,
    query: 'Easy Fixes 🤖', // Search by name
    sort: ['-popularity'],
    createdBy: GroupSearchViewCreatedBy.ME,
  });

  const allViews = useMemo(() => [...othersViews, ...myViews], [othersViews, myViews]);

  // Define the properties of the view we want to create/find
  const targetViewProperties = useMemo(
    () => ({
      name: 'Easy Fixes 🤖',
      query: 'is:unresolved issue.seer_actionability:[high,super_high]',
      querySort: IssueSortOptions.DATE,
      projects: organization.features.includes('global-views')
        ? []
        : [Number(project.id)],
      environments: [],
      timeFilters: {
        start: null,
        end: null,
        period: '7d',
        utc: null,
      },
    }),
    [organization.features, project.id]
  );

  // Check if an existing view matches our criteria
  const existingMatchingView = useMemo(() => {
    return allViews.find((view: GroupSearchView) => {
      // Must have exact name match
      if (view.name !== targetViewProperties.name) {
        return false;
      }

      // Must query the right field
      if (
        !view.query.includes('issue.seer_actionability:[high,super_high]') &&
        !view.query.includes('issue.seer_actionability:[super_high,high]') &&
        !view.query.includes('issue.seer_actionability:super_high')
      ) {
        return false;
      }

      // Check project match - either matches current project or is "All Projects" (empty array)
      const viewHasNoProjects = view.projects.length === 0;
      const viewHasCurrentProject = view.projects.includes(Number(project.id));
      const projectMatches = viewHasNoProjects || viewHasCurrentProject;

      if (!projectMatches) {
        return false;
      }

      return true;
    });
  }, [allViews, targetViewProperties, project.id]);

  const handleStarFixabilityView = () => {
    if (existingMatchingView) {
      // Star the existing view instead of creating a new one
      starExistingView({
        id: existingMatchingView.id,
        starred: true,
        view: existingMatchingView,
      });
    } else {
      // Create a new view
      let projects: number[] = [];
      if (!organization.features.includes('global-views')) {
        projects = [Number(project.id)];
      }
      createIssueView({
        name: 'Easy Fixes 🤖',
        query: 'is:unresolved issue.seer_actionability:[high,super_high]',
        querySort: IssueSortOptions.DATE,
        projects,
        environments: [],
        timeFilters: {
          start: null,
          end: null,
          period: '7d',
          utc: null,
        },
        starred: true,
      });
    }
  };

  return (
    <Button
      onClick={handleStarFixabilityView} redesign
      size="sm"
      priority="primary"
      disabled={isCompleted}
      aria-label={isCompleted ? t('View already starred') : t('Star recommended view')}
    >
      {isCompleted ? t('View Already Starred') : t('Star Recommended View')}
    </Button>
  );
}

export default StarFixabilityViewButton;
