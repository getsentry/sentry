import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {Confirm} from 'sentry/components/confirm';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {ToolbarHeader} from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';

type Props = {
  hasSimilarityEmbeddingsFeature: boolean;
  mergeCount: number;
  onMerge: () => void;
};

export function SimilarToolbar({
  hasSimilarityEmbeddingsFeature,
  mergeCount,
  onMerge,
}: Props) {
  return (
    <PanelHeader hasButtons>
      <Flex gap="md">
        <Confirm
          disabled={mergeCount === 0}
          message={t('Are you sure you want to merge these issues?')}
          onConfirm={onMerge}
        >
          <Button size="xs" tooltipProps={{title: t('Merging %s issues', mergeCount)}}>
            {t('Merge %s', `(${mergeCount || 0})`)}
          </Button>
        </Confirm>
      </Flex>

      <Flex align="center" flexShrink={0} width="325px" minWidth="325px">
        <StyledToolbarHeader>{t('Events')}</StyledToolbarHeader>
        <StyledToolbarHeader>{t('Exception')}</StyledToolbarHeader>
        {!hasSimilarityEmbeddingsFeature && (
          <StyledToolbarHeader>{t('Message')}</StyledToolbarHeader>
        )}
      </Flex>
    </PanelHeader>
  );
}

const StyledToolbarHeader = styled(ToolbarHeader)`
  flex: 1;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: ${p => p.theme.space.xs} 0;
`;
