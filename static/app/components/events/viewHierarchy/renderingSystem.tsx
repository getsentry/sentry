import styled from '@emotion/styled';

import Pill from 'sentry/components/pill';
import {t} from 'sentry/locale';

type RenderingSystemProps = {
  system?: string;
};

function RenderingSystem({system}: RenderingSystemProps) {
  return <StyledPill name={t('Rendering System')} value={system ?? t('Unknown')} />;
}

export {RenderingSystem};

const StyledPill = styled(Pill)`
  width: max-content;
`;
