import styled from '@emotion/styled';

import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {t} from 'sentry/locale';
import ReleasesDropdown from 'sentry/views/releases/list/releasesDropdown';

const displayOptions = {
  [PreprodBuildsDisplay.SIZE]: {label: t('Size')},
  [PreprodBuildsDisplay.DISTRIBUTION]: {label: t('Distribution')},
};

type Props = {
  onSelect: (display: PreprodBuildsDisplay) => void;
  selected: PreprodBuildsDisplay;
};

function PreprodBuildsDisplayOptions({selected, onSelect}: Props) {
  return (
    <StyledReleasesDropdown
      label={t('Display')}
      options={displayOptions}
      selected={selected}
      onSelect={key => onSelect(key as PreprodBuildsDisplay)}
    />
  );
}

export default PreprodBuildsDisplayOptions;

const StyledReleasesDropdown = styled(ReleasesDropdown)`
  z-index: 1;
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    order: 3;
  }
`;
