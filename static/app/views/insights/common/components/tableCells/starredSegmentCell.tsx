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

export function StarredSegmentCell({segmentName, initialIsStarred, projectSlug}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === projectSlug);

  const {toggleStarredTransaction, isPending, isStarred} = useStarredSegment({
    initialIsStarred,
    projectId: project?.id,
    segmentName,
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
            color={isStarred ? 'yellow300' : 'gray200'}
            isSolid={isStarred}
            data-test-id="starred-transaction-column"
          />
        }
        aria-label={t('Toggle star for transaction')}
      />
    </FlexContainer>
  );
}
