import {Button} from 'sentry/components/core/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {FlexContainer} from 'sentry/utils/discover/styles';
import useProjects from 'sentry/utils/useProjects';
import {useStarredSegment} from 'sentry/views/insights/common/utils/useStarredSegment';

interface Props {
  initialIsStarred: boolean;
  projectSlug: string;
  segmentName: string;
}

// The query key used for the starred segments table request, this key is used to reference that query and update the starred segment state
export const STARRED_SEGMENT_TABLE_QUERY_KEY = ['starred-segment-table'];

export function StarredSegmentCell({segmentName, initialIsStarred, projectSlug}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === projectSlug);

  const {toggleStarredTransaction, isPending} = useStarredSegment({
    projectId: project?.id,
    segmentName,
    tableQueryKey: STARRED_SEGMENT_TABLE_QUERY_KEY,
  });

  const disabled = !project || !segmentName || isPending;

  return (
    <FlexContainer>
      <Button
        onClick={toggleStarredTransaction}
        disabled={disabled}
        borderless
        size="zero"
        icon={
          <IconStar
            color={initialIsStarred ? 'yellow300' : 'gray200'}
            isSolid={initialIsStarred}
            data-test-id="starred-transaction-column"
          />
        }
        aria-label={t('Toggle star for transaction')}
      />
    </FlexContainer>
  );
}
