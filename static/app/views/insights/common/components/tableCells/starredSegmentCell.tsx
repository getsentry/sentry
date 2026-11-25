import {IconStar} from '@sentry/icons/star';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {FlexContainer} from 'sentry/utils/discover/styles';
import {useProjects} from 'sentry/utils/useProjects';
import {useStarredSegment} from 'sentry/views/insights/common/utils/useStarredSegment';

interface Props {
  isStarred: boolean;
  segmentName: string;
  projectId?: string;
  projectSlug?: string;
}

export function StarredSegmentCell({
  segmentName,
  isStarred,
  projectSlug,
  projectId,
}: Props) {
  const {projects} = useProjects();
  const project =
    projects.find(p => p.slug === projectSlug) ?? projects.find(p => p.id === projectId);
  const selectedProjectId = project?.id ?? projectId;
  const selectedProjectSlug = project?.slug ?? projectSlug;

  const {setStarredSegment, isPending} = useStarredSegment({
    selectedProjectId,
    selectedProjectSlug,
    segmentName,
  });

  const disabled = !selectedProjectId || !segmentName || isPending;

  return (
    <FlexContainer>
      <Button
        onClick={() => setStarredSegment(!isStarred)}
        disabled={disabled}
        variant="transparent"
        size="zero"
        icon={
          <IconStar
            variant={isStarred ? 'warning' : 'muted'}
            isSolid={isStarred}
            size="sm"
            data-test-id="starred-transaction-column"
          />
        }
        aria-label={t('Toggle star for transaction')}
      />
    </FlexContainer>
  );
}
