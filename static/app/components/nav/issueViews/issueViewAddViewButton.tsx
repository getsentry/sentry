import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useNavContext} from 'sentry/components/nav/context';
import useDefaultProject from 'sentry/components/nav/issueViews/useDefaultProject';
import {NavLayout} from 'sentry/components/nav/types';
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
            isAllProjects: false,
            environments: DEFAULT_ENVIRONMENTS,
            timeFilters: DEFAULT_TIME_FILTERS,
          },
        ],
        orgSlug: organization.slug,
      });
    }
  };

  return (
    <motion.div>
      <AddViewButton
        borderless
        size="zero"
        layout={layout}
        onClick={handleOnAddView}
        disabled={isLoading}
      >
        {isLoading ? (
          <LoadingIndicator mini />
        ) : (
          <Fragment>
            <StyledIconAdd size="xs" />
            {t('Add View')}
          </Fragment>
        )}
      </AddViewButton>
    </motion.div>
  );
}

const AddViewButton = styled(Button)<{layout: NavLayout}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(0.5)};

  width: 100%;
  position: relative;
  height: 34px;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  line-height: 177.75%;
  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    color: inherit;
  }

  [data-isl] {
    transform: translate(0, 0);
    top: 1px;
    bottom: 1px;
    right: 0;
    left: 0;
    width: initial;
    height: initial;
  }

  ${p =>
    p.layout === NavLayout.MOBILE &&
    css`
      padding: 0 ${space(1.5)} 0 48px;
      border-radius: 0;
    `}
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: 4px;
`;
