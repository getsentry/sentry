import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DEFAULT_ENVIRONMENTS,
  DEFAULT_TIME_FILTERS,
} from 'sentry/views/issueList/issueViews/issueViews';
import {useUpdateGroupSearchViews} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViews';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {useNavContext} from 'sentry/views/nav/context';
import useDefaultProject from 'sentry/views/nav/secondary/sections/issues/issueViews/useDefaultProject';
import type {NavLayout} from 'sentry/views/nav/types';

export function IssueViewAddViewButton({baseUrl}: {baseUrl: string}) {
  const navigate = useNavigate();
  const organization = useOrganization();

  const {layout} = useNavContext();
  const [isLoading, setIsLoading] = useState(false);

  const defaultProject = useDefaultProject();

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
  });

  const {mutate: updateViews} = useUpdateGroupSearchViews({
    onSuccess: data => {
      if (data?.length) {
        navigate(
          normalizeUrl({
            pathname: `${baseUrl}/views/${data.at(-1)!.id}/`,
          })
        );
        setIsLoading(false);
      }
    },
  });

  const handleOnAddView = () => {
    if (groupSearchViews) {
      setIsLoading(true);
      updateViews({
        groupSearchViews: [
          ...groupSearchViews,
          {
            name: 'New View',
            query: 'is:unresolved',
            querySort: IssueSortOptions.DATE,
            projects: defaultProject,
            environments: DEFAULT_ENVIRONMENTS,
            timeFilters: DEFAULT_TIME_FILTERS,
            starred: true,
          },
        ],
        orgSlug: organization.slug,
      });
    }
  };

  return (
    <AddViewButton
      borderless
      size="zero"
      layout={layout}
      onClick={handleOnAddView}
      disabled={isLoading}
      title={!isLoading && t('Add View')}
      aria-label={t('Add View')}
      tooltipProps={{
        delay: 500,
      }}
      icon={
        isLoading ? (
          <StyledLoadingIndicator mini size={14} />
        ) : (
          <IconAdd size="sm" color="subText" />
        )
      }
    />
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;

const AddViewButton = styled(Button)<{layout: NavLayout}>`
  padding: ${space(0.5)};
  margin-right: -${space(0.5)};
`;
