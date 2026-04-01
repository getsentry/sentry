import styled from '@emotion/styled';

import {DetailSection} from 'sentry/components/workflowEngine/ui/detailSection';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {MarkedText} from 'sentry/utils/marked/markedText';

export function DetectorDetailsDescription({
  description,
}: {
  description: Detector['description'];
}) {
  if (!description) {
    return null;
  }
  return (
    <DetailSection title={t('Description')}>
      <StyledMarkedText text={description} />
    </DetailSection>
  );
}

const StyledMarkedText = styled(MarkedText)`
  word-wrap: break-word;

  p {
    margin: 0;
  }
`;
