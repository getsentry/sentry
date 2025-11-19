import styled from '@emotion/styled';

import Section from 'sentry/components/workflowEngine/ui/section';
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
    <Section title={t('Description')}>
      <StyledMarkedText text={description} />
    </Section>
  );
}

const StyledMarkedText = styled(MarkedText)`
  word-wrap: break-word;

  p {
    margin: 0;
  }
`;
